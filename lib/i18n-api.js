'use strict';

const
    i18n = require('i18n'),
    config = require(__dirname + '/../config/config');

const __t = function (locale, phrase) {
    if (locale) {
        if (arguments.length == 2) {
            return i18n.__({
                phrase: phrase,
                locale: locale
            });
        } else {
            return i18n.__({
                phrase: phrase,
                locale: locale
            }, arguments[2]);
        }
    } else {
        if (arguments.length == 2) {
            return i18n.__(phrase);
        } else {
            return i18n.__(phrase, arguments[2]);
        }
    }
};

module.exports = {
    configure: i18n.configure,
    normalize: (req, res, next) => {
        const alangs = req.headers['accept-language'];
        if (alangs) {
            if ((/zh-han(s|t)-(\w+)/ig).test(alangs)) {
                //windows 10 has hans or hant in the middle for simplified or traditional Chinese, replace them
                req.headers['accept-language'] = alangs.replace(/zh-han(s|t)-(\w+)/ig, 'zh-$2').toLowerCase();
            } else {
                req.headers['accept-language'] = alangs.toLowerCase();
            }
        }
        if (!req.locale) {
            req.locale = config.defaultLocale;
        }
        next();
    },
    init: (req, resp, next) => {
        resp.__t = __t.bind(resp);
        resp.locals = {
            __t: __t.bind(resp.locales)
        };
        i18n.init(req, resp, next);
    },
    __t: __t
};