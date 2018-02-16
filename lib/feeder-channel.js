'use strict';

const
    path = require('path'),
    fs = require('fs'),
    B = require('bluebird'),
    config = require(__dirname + '/../config/config');

const defer = () => {
    var resolve, reject;
    var promise = new B((_1, _2) => {
        resolve = _1;
        reject = _2;
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};

const feeder_model = function (channel, opts) {
    const
        self = this,
        _pause = opts._pause,
        _resume = opts._resume,
        _stop = opts._stop;

    self.id = channel.id;
    self.type = channel.type;
    self.live_stream = channel.live_stream;
    self.mime_type = channel.mime_type;
    self.user_id = channel.user_id;
    self.endpoint_id = channel.endpoint_id;
    self.total_size = channel.total_size;
    self.readers = [];

    const save_media = !!channel.save_media;
    const sink_folder = path.join(process.cwd(), 'data/streams');
    if (!fs.existsSync(sink_folder)) {
        fs.mkdirSync(sink_folder);
    }
    self.sink_path = path.join(sink_folder, channel.media_name || self.id.replace('::', '_'));
    const waits = [];

    let wfd = fs.openSync(self.sink_path, 'w', 0o666);
    let remain = undefined;
    let curr_buf = undefined;
    let data_size;
    let curr_top = 0;
    let ended = false;

    self.curr_live_pos = () => curr_top;

    self.pause = reader => {
        let all = true;
        for (let i = 0; i < self.readers.length; i++) {
            if (!self.readers[i].suspended) {
                all = false;
                break;
            }
        }
        if (all && typeof _pause === 'function') {
            _pause();
        }
    };

    self.resume = reader => {
        let any = false;
        for (let i = 0; i < self.readers.length; i++) {
            if (!self.readers[i].suspended) {
                any = true;
                break;
            }
        }
        if (any && typeof _resume === 'function') {
            //const max_reader_pos = Math.max(...self.readers.map(r => r.pos));
            //if (curr_top - max_reader_pos < 1024 * 1) {
            _resume();
            //}
        }
    };

    const coordinate_speed = () => {
        const max_reader_pos = Math.max(...self.readers.map(r => r.pos));
        if (curr_top - max_reader_pos > 1024 * 5) {
            _pause();
        } else if (curr_top - max_reader_pos < 1024 * 1) {
            _resume();
        }
    };

    self.readBlock = (reader, size) => {
        //coordinate_speed();
        return new B(function (resolve, reject) {
            const reader = this;
            if (!reader.fd) {
                reader.fd = fs.openSync(self.sink_path, 'r', 0o666);
            }
            if (reader.pos < curr_top) {
                if (size > curr_top - reader.pos)
                    size = curr_top - reader.pos;
                const buffer = Buffer.alloc(size);
                const read = nbytes => {
                    fs.read(reader.fd, buffer, nbytes, size - nbytes, reader.pos, (err, delta, bf) => {
                        reader.pos += delta;
                        if (nbytes + delta < size) {
                            read(nbytes + delta);
                        } else {
                            resolve(buffer);
                        }
                    });
                };
                read(0);
                /*
                let nbytes = 0;
                while (nbytes < size) {
                    const delta = fs.readSync(reader.fd, buffer, nbytes, size - nbytes, reader.pos);
                    nbytes += delta;
                    reader.pos += delta;
                }
                resolve(buffer);
                */

            } else if (!self.total_size || reader.pos < self.total_size) {
                const task = defer();
                waits.push({
                    reader: reader,
                    task: task,
                    size: size
                });
                resolve(task.promise);
            } else {
                resolve(null);
            }
        }.bind(reader));
    };

    const clean_up_service = () => {
        if (curr_buf.length > 1) {
            remain = curr_buf.slice(1);
        } else {
            remain = undefined;
        }
        self.end();
        if (wfd) {
            fs.close(wfd);
            wfd = undefined;
        }
    };

    const data_offset = 9;

    self.ondata = block => {
        if (remain && remain.length > 0) {
            curr_buf = Buffer.alloc(remain.length + block.length);
            remain.copy(curr_buf);
            block.copy(curr_buf, remain.length);
            remain = undefined;
        } else {
            curr_buf = block;
        }
        while (curr_buf) {
            const b = curr_buf[0];
            switch (b) {
                case 0x00:
                    data_size = curr_buf.readInt32BE(1);
                    break;
                case 0x01:
                    clean_up_service();
                    if (typeof _stop === 'function') {
                        _stop();
                    }
                    return;
                case 0x02:
                    clean_up_service();
                    return;
            }
            const resolve_waits = () => {
                const irmv = [];
                for (let i = 0; i < waits.length; i++) {
                    if (waits[i].buffers) {
                        const data = Buffer.concat(waits[i].buffers);
                        waits[i].task.resolve(data);
                        waits[i].reader.pos += data.length;
                        irmv.push(i);
                    }
                };
                if (irmv.length > 0) {
                    for (let i = irmv.length - 1; i >= 0; i--) {
                        waits.splice(irmv[i]);
                    }
                }
            };
            if (curr_buf.length >= data_size + data_offset) {
                let nbytes = 0;
                while (nbytes < data_size) {
                    const delta = fs.writeSync(wfd, curr_buf, data_offset + nbytes, data_size - nbytes, curr_top);
                    nbytes += delta;
                    curr_top += delta;
                }
                //coordinate_speed();
                let buf = undefined;
                waits.forEach(w => {
                    if (!buf) {
                        buf = Buffer.alloc(data_size);
                        curr_buf.copy(buf, 0, data_offset, data_size + data_offset);
                    }
                    w.buffers = w.buffers || [];
                    w.buffers.push(buf);
                });
                if (curr_buf.length > data_size + data_offset) {
                    curr_buf = curr_buf.slice(data_size + data_offset);
                } else {
                    remain = undefined;
                    curr_buf = undefined;
                    resolve_waits();
                }
                if (self.total_size && curr_top === self.total_size) {
                    fs.close(wfd);
                    wfd = undefined;
                    curr_buf = undefined;
                    remain = undefined;
                }
            } else {
                remain = curr_buf;
                curr_buf = undefined;
                resolve_waits();
            }
        }
    };

    self.end = () => {
        if (ended)
            return;
        ended = true;
        self.readers.forEach(r => {
            r.end();
            if (r.fd) {
                fs.close(r.fd, err => {});
                r.fd = undefined;
            }
        });
        if (wfd) {
            fs.close(wfd, err => {
                if (err) {
                    console.log(err);
                }
                if (!save_media) {
                    fs.unlink(self.sink_path, err => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            });
            wfd = undefined;
        } else {
            if (!save_media) {
                fs.unlink(self.sink_path, err => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        }
    };
}

module.exports = feeder_model;