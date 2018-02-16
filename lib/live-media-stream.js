'use strict';

const
    path = require('path'),
    emitter = require('events'),
    util = require('util'),
    {
        Readable
    } = require('stream');

const live_media_stream = function (src, opts) {
    if (!(this instanceof live_media_stream))
        return new live_media_stream(opts);
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
            if (!self.push(data) && data) {
                self.suspended = true;
            }
        }).catch(err => {
            console.log('readBlock error:');
            console.log(err);
        });
        self.suspended = false;
    };
}

util.inherits(live_media_stream, Readable);

module.exports = live_media_stream;