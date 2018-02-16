'use strict';

const
    _ = require('lodash'),
    stackTrace = require('stack-trace'),
    i18n = require(__dirname + '/i18n-api');

const cachers = function (app) {
    // will print stacktrace
    if (app.get('env') === 'development') {
        app.use((err, req, res, next) => {
            if (err.httpCode && err.httpCode !== 500) {
                const _err = err.message || err.msg || err.err || (typeof err === 'string' ? err : JSON.stringify(err));
                //winston.log('info', _err);
                res.statusCode = err.httpCode;
                res.send(_err);
                res.end();
            } else if (err.auth_failed) {
                res.statusCode = 403;
                res.render('access-denied.html', err);
            } else {
                let _err;
                if (err instanceof Error) {
                    _err = err.message;
                    let trace = stackTrace.parse(err);
                    let traceList = _.map(trace, t => {
                        return JSON.stringify(t);
                    });
                    let traceMsg = _.reduce(traceList, (str, ts) => {
                        return str + ts + '\n';
                    }, '');
                    console.log('error', _err);
                    console.log('error', traceMsg);
                    res.render('error.html', {
                        title: 'Error',
                        message: [_err, traceMsg]
                    });
                } else {
                    _err = err.message || err.msg || err.err || (typeof err === 'string' ? err : JSON.stringify(err));
                    console.log('error', _err);
                    res.render('error.html', {
                        title: 'Error',
                        message: _err
                    });
                }
            }
        });
    } else {
        app.use((err, req, res, next) => {
            if (err.httpCode && err.httpCode !== 500) {
                let _err = err.message || err.msg || err.err || (typeof err === 'string' ? err : JSON.stringify(err));
                //winston.log('info', _err);
                res.statusCode = err.httpCode;
                res.send(_err);
                res.end();
            } else if (err.auth_failed) {
                res.statusCode = 403;
                res.render('access-denied.html', err);
            } else {
                let _err = err.message || err.msg || err.err || (typeof err === 'string' ? err : JSON.stringify(err));
                console.log('error', _err);
                res.statusCode = 500;
                res.render('error.html', {
                    title: 'Error',
                    message: _err
                });
            }
        });
    }
};

module.exports = cachers;