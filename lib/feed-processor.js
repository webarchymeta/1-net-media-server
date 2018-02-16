'use strict';

const
    config = require(__dirname + '/../config/config'),
    feeder_channel = require(__dirname + '/feeder-channel');

const _pause = function () {
    if (!this.sync_stream) {
        const b = Buffer.alloc(1);
        b[0] = 0x00;
        this.s.write(b);
    } else {
        if (!this.s.isPaused())
            this.s.pause();
    }
};

const _resume = function () {
    if (!this.sync_stream) {
        const b = Buffer.alloc(1);
        b[0] = 0x01;
        this.s.write(b);
    } else {
        if (this.s.isPaused())
            this.s.resume();
    }
};

const _stop = function () {
    const bf = Buffer.alloc(1);
    bf[0] = 0xff;
    this.s.write(bf);
};

const handshaker = (socket, data) => {
    const channel = JSON.parse(data.toString('utf8'));
    channel.id = channel.endpoint_id + '::' + channel.stream_id;
    let feeder;
    feeder = new feeder_channel(channel, {
        _pause: _pause.bind({
            sync_stream: channel.live_stream,
            s: socket
        }),
        _resume: _resume.bind({
            sync_stream: channel.live_stream,
            s: socket
        }),
        _stop: _stop.bind({
            s: socket
        })
    });
    socket.channel_id = feeder.id;
    global.feeders = global.feeders || [];
    global.feeders.push(feeder);
    socket.on('data', feeder.ondata);
    socket.on('error', err => {
        console.log(err);
    });
    global.__io.emit('/stream-cast/channel-join', channel);
    socket.write(Buffer.from(JSON.stringify({
        ok: true
    }), 'utf8'));
};

module.exports = s => {
    s.once('data', function (data) {
        handshaker(this, data);
    }.bind(s));
    s.once('end', function () {
        let idx = -1;
        for (let i = 0; i < global.feeders.length; i++) {
            if (global.feeders[i].id == this.channel_id) {
                global.feeders[i].end();
                idx = i;
                break;
            }
        }
        if (idx > -1) {
            global.feeders.splice(idx, 1);
        }
        global.__io.emit('/stream-cast/channel-leave', {
            id: this.channel_id
        });
        this.end();
        this.destroy();
    }.bind(s));
};