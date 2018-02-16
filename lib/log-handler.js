'use strict';

const
    path = require('path'),
    logger = require('morgan');

module.exports = config => {
    const http_conf = config.log && config.log.http ? config.log.http : undefined;
    const logdir = process.env.HTTP_LOGBASEDIR ? process.env.HTTP_LOGBASEDIR : http_conf && http_conf.relocate.enabled ? http_conf.relocate.basePath : path.join(process.cwd(), 'logs/');
    return app => {
        if (http_conf && http_conf.enabled) {
            if (app.get('env') === 'development') {
                app.use(logger('dev'));
            } else {
                const logfile = path.join(logdir, http_conf && http_conf.relativePath ? path.join(http_conf.relativePath, '%DATE%.log') : 'gateway/%DATE%.log');
                const accessLogStream = require('file-stream-rotator').getStream({
                    filename: logfile,
                    frequency: http_conf && http_conf.rotation && http_conf.rotation.frequency ? http_conf.rotation.frequency : 'daily',
                    verbose: false,
                    date_format: http_conf && http_conf.rotation && http_conf.rotation.date_format ? http_conf.rotation.date_format : 'YYYY-MM-DD'
                });
                app.use(logger('combined', {
                    stream: accessLogStream
                }))
            }
        }
    };
};