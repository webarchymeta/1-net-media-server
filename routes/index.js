'use strict';

const
    path = require('path'),
    fs = require('fs'),
    uuid = require('uuid'),
    router = require('express').Router(),
    i18n = require(__dirname + '/../lib/i18n-api'),
    config = require(__dirname + '/../config/config');

const stream_ctrlr = require(__dirname + '/../controllers/stream-cast-controller');

router.use(/^\/stream-cast/, (req, res, next) => {
    const r = require('express').Router();
    r.use('/', stream_ctrlr);
    r.handle(req, res, next);
});

router.get('/error', (req, res) => {
    res.render('error.html', {
        title: req.query.t ? req.query.t : i18n.__t(req.locale, '902b0d55fddef6f8d651fe1035b7d4bd' /*Error*/ ),
        message: req.query.msg ? JSON.parse(req.query.msg) : 'Failed'
    });
});

router.get('/', (req, res) => {
    res.redirect('/stream-cast'); //tmp
    /*
    res.render('index.html', {

    });
    */
});

module.exports = router;