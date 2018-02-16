'use strict';

const
    path = require('path'),
    fs = require('fs'),
    uuid = require('uuid'),
    router = require('express').Router(),
    rangeParser = require('range-parser'),
    i18n = require(__dirname + '/../lib/i18n-api'),
    config = require(__dirname + '/../config/config'),
    live_media_stream = require(__dirname + '/../lib/live-media-stream'),
    file_media_stream = require(__dirname + '/../lib/file-media-stream'),
    local_media_stream = require(__dirname + '/../lib/local-media-stream');


const maxDataStreamLength = 100000000000000000000;

router.get('/local/:filename', (req, res) => {
    const readStream = new local_media_stream({
        filename: req.params.filename
    });
    res.setHeader('Content-Type', 'video/webm');
    readStream.pipe(res);
});

router.head('/file/:channel_id', (req, res) => {
    let channel = undefined;
    if (req.params.channel_id) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders.find(c => c.id === req.params.channel_id);
        }
    } else if (global.feeders && global.feeders.length > 0) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders[0];
        }
    }
    if (channel) {
        res.sendStatus(200);
        res.setHeader('Content-Type', channel.mime_type);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Accept-Ranges', 'bytes');
        res.end();
    } else {
        res.sendStatus(404);
        res.end();
    }
});

const readStreams = [];

const removeReader = (id, channel_id) => {
    let idx = -1;
    for (let i = 0; i < readStreams.length; i++) {
        if (readStreams[i].id === id && readStreams[i].channel.id === channel_id) {
            idx = i;
            break;
        }
    }
    if (idx > -1) {
        readStreams[idx].leave();
        if (readStreams[idx].fd) {
            fs.close(readStreams[idx].fd);
            readStreams[idx].fd = undefined;
        }
        readStreams.splice(idx, 1);
    }
};

router.get('/file/:channel_id', (req, res) => {
    let channel = undefined;
    if (req.params.channel_id) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders.find(c => c.id === req.params.channel_id);
        }
    } else if (global.feeders && global.feeders.length > 0) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders[0];
        }
    }
    if (channel) {
        req.session.id = req.session.id || uuid.v4();
        removeReader(req.session.id, req.params.channel_id);
        if (req.headers.range) {
            const ranges = rangeParser(channel.total_size ? channel.total_size : maxDataStreamLength, req.headers.range);
            console.log(ranges[0]);
            let range_spec = 'bytes ' + ranges[0].start + '-' + ranges[0].end + '/' + (channel.total_size ? channel.total_size : '*');
            const readStream = new file_media_stream(channel, {
                id: req.session.id,
                start: ranges[0].start
            });
            res.on('close', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.on('finish', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.setHeader('Content-Type', channel.mime_type);
            if (channel.total_size) {
                res.setHeader('Content-Length', ranges[0].end - ranges[0].start + 1);
            }
            res.setHeader('Content-Range', range_spec);
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Accept-Ranges', 'bytes');
            readStreams.push(readStream);
            readStream.pipe(res);
        } else {
            const readStream = new file_media_stream(channel, {
                id: req.session.id,
                start: 0
            });
            res.on('close', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.on('finish', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.setHeader('Content-Type', channel.mime_type);
            if (channel.total_size) {
                res.setHeader('Content-Length', channel.total_size);
            }
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Accept-Ranges', 'bytes');
            readStreams.push(readStream);
            readStream.pipe(res);
        }
    } else {
        res.sendStatus(404);
        res.end();
    }
});

router.head('/live/:channel_id', (req, res) => {
    let channel = undefined;
    if (req.params.channel_id) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders.find(c => c.id === req.params.channel_id);
        }
    } else if (global.feeders && global.feeders.length > 0) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders[0];
        }
    }
    if (channel) {
        res.sendStatus(200);
        res.setHeader('Content-Type', channel.mime_type);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Accept-Ranges', 'bytes');
        res.end();
    } else {
        res.sendStatus(404);
        res.end();
    }
});

router.get('/live/:channel_id', (req, res) => {
    let channel = undefined;
    if (req.params.channel_id) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders.find(c => c.id === req.params.channel_id);
        }
    } else if (global.feeders && global.feeders.length > 0) {
        if (global.feeders && global.feeders.length > 0) {
            channel = global.feeders[0];
        }
    }
    if (channel) {
        req.session.id = req.session.id || uuid.v4();
        removeReader(req.session.id);
        if (req.headers.range) {
            const ranges = rangeParser(channel.total_size ? channel.total_size : maxDataStreamLength, req.headers.range);
            let range_spec = 'bytes ' + ranges[0].start + '-' + ranges[0].end + '/' + (channel.total_size ? channel.total_size - ranges[0].start : '*');
            const readStream = new live_media_stream(channel, {
                id: req.session.id,
                start: ranges[0].start
            });
            res.on('close', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.on('finish', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.setHeader('Content-Type', channel.mime_type);
            res.setHeader('Content-Range', range_spec);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Accept-Ranges', 'bytes');
            readStreams.push(readStream);
            readStream.pipe(res);
        } else {
            const readStream = new live_media_stream(channel, {
                id: req.session.id,
                start: 0
            });
            res.on('close', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.on('finish', function () {
                removeReader(this.id, this.channel_id);
            }.bind({
                id: req.session.id,
                channel_id: req.params.channel_id
            }));
            res.setHeader('Content-Type', channel.mime_type);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Accept-Ranges', 'bytes');
            readStreams.push(readStream);
            readStream.pipe(res);
        }
    } else {
        res.sendStatus(404);
        res.end();
    }
});

router.post('/leave-channel', (req, res) => {
    const channel = global.feeders.find(c => id === req.body.channel_id);
    if (channel) {
        const reader = channel.readers.find(r => r.id === req.session.id);
        if (reader)
            reader.leave();
    }
    res.json({
        ok: true
    });
});

router.post('/load-channels', (req, res) => {
    res.json(global.feeders ? global.feeders.map(c => {
        const channel = {};
        Object.keys(c).forEach(k => {
            if (typeof c[k] !== 'object')
                channel[k] = c[k];
        });
        return channel;
    }) : []);
});

router.get('/', (req, res) => {
    res.render('stream-casts.html', {

    });
});

module.exports = router;