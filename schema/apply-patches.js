'use strict';

const
    path = require('path'),
    winston = require('winston');

const
    config = require(__dirname + '/config/config');

global.config = config;

const
    sqlite = require(__dirname + '/../lib/sqlite-api');

winston.level = config.logLevel || 'info';

sqlite.open().then(() => {
    winston.log('info', 'database schema patch successful ...');
    sqlite.close();
}).catch(err => {
    winston.log('info', 'database schema patch failed ...');
    sqlite.close();
});