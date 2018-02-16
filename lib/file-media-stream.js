'use strict';

const
    path = require('path'),
    emitter = require('events'),
    util = require('util'),
    {
        Readable
    } = require('stream');

const file_media_stream = function (src, opts) {
    if (!(this instanceof file_media_stream))
        return new file_media_stream(opts);
    Readable.call(this, opts);
    const self = this;
    self.id = opts.id;
    self.channel = src;
    self.fd = undefined;
    self.suspended = true;
    self.pos = opts.start || 0;

    self.channel.readers.push(self);

    self.end = () => {
        self.push(null);
    };

    self.leave = () => {
        let idx = -1;
        for (let i = 0; i < self.channel.readers.length; i++) {
            if (self.channel.readers[i] == self) {
                idx = i;
                break;
            }
        }
        if (idx > -1) {
            self.channel.readers.splice(idx, 1);
        }
    };

    self._read = size => {
        self.channel.readBlock(self, size).then(data => {
            //console.log(`pos: ${self.pos}, data: ${data.length} bytes, prev pos: ${self.pos - (data ? data.length : 0)}`);
            if (!self.push(data) && data) {
                self.suspended = true;
                if (!self.channel.live_stream)
                    self.channel.pause(self);
            }
        }).catch(err => {
            console.log('readBlock error:');
            console.log(err);
        });
        self.suspended = false;
        if (!self.channel.live_stream)
            self.channel.resume(self);
    };
};

util.inherits(file_media_stream, Readable);

module.exports = file_media_stream;