const
    path = require('path'),
    fs = require('fs'),
    emitter = require('events'),
    util = require('util'),
    {
        Readable
    } = require('stream');

const test_source = function () {
    const self = this;
    let readStream = undefined;

    //let filePath = path.join(__dirname, '/../data/screenCap_1517174285136.webm');
    let filePath = path.join(__dirname, '/../data/');
    let filename;
    let stat = fs.statSync(filePath);

    self.readStart = init => {
        if (!init) {
            readStream = fs.createReadStream(path.join(filePath, filename));
            readStream.on('data', data => {
                self.emit('data', data);
            });
            readStream.on('end', () => {
                self.emit('end');
            });
            readStream.on('error', err => {
                self.emit('end');
            });
            readStream.on('close', () => {
                self.emit('end');
            });
        }
        if (readStream.isPaused()) {
            readStream.resume();
        }
    };

    self.readStop = () => {
        if (readStream && !readStream.isPaused()) {
            readStream.pause();
        }
    };
};

util.inherits(test_source, emitter);

const file_media_stream = function (opts) {
    if (!(this instanceof media_stream))
        return new media_stream(opts);
    Readable.call(this, opts);

    filename = opts.filename;

    const self = this;
    const source = new test_source();

    let pos = 0;
    let curr_data = undefined;
    let curr_pos = 0;
    let curr_size = 0;

    self.offset = () => pos;

    source.on('data', data => {
        curr_data = data;
        curr_pos = 0;
        if (curr_data.length > curr_size) {
            curr_pos += curr_size;
            pos += curr_size;
            const block = curr_data.slice(0, curr_size);
            if (!self.push(block))
                source.readStop();
        } else {
            curr_pos += data.length;
            pos += data.length;
            if (!self.push(data))
                source.readStop();
        }
    });

    source.on('end', data => {
        self.push(null);
    });

    self._read = size => {
        curr_size = size;
        if (!curr_data || curr_pos >= curr_data.length) {
            source.readStart(!!curr_data);
        } else {
            source.readStop();
            if (curr_data.length > curr_pos + curr_size) {
                const block = curr_data.slice(curr_pos, curr_pos + curr_size);
                curr_pos += curr_size;
                self.push(block);
            } else {
                const block = curr_data.slice(curr_pos);
                curr_pos = curr_data.length;
                self.push(block);
            }
        }
    };
}

util.inherits(file_media_stream, Readable);

module.exports = file_media_stream;