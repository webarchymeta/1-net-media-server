'use strict';

const
    B = require('bluebird'),
    os = require('os'),
    winston = require('winston'),
    sqlite = require(__dirname + '/sqlite-api'),
    mdns_api = require(__dirname + '/multicast-dns');

const interfaces = [];
const subnets = config.dns && config.dns.multicast && config.dns.multicast.subnets && config.dns.multicast.subnets.length > 0 ? config.dns.multicast.subnets : undefined;
const ip_family = config.dns && config.dns.multicast && config.dns.multicast.ip_family ? config.dns.multicast.ip_family : 'ipv4';

const ifaces = os.networkInterfaces();
Object.keys(ifaces).forEach(key => {
    ifaces[key].forEach(ip => {
        if (!ip.internal && ip_family.toLowerCase() === ip.family.toLowerCase()) {
            if (!subnets || subnets.find(sn => ip.address.indexOf(sn.prefix) === 0)) {
                interfaces.push(ip.address);
            }
        }
    });
});

const defer = () => {
    let resolve, reject;
    const promise = new B((_1, _2) => {
        resolve = _1;
        reject = _2;
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};

const service = function () {
    const self = this;

    const web_ui_name_pattern = /\.ui\.media\.local$/;
    const peer_api_name_pattern = /\.peer\.media\.local$/;

    self.init = (opts) => {
        const mdns = new mdns_api({
            subnets: config.dns.multicast.subnets,
            loopback: true,
            use_group_ip: config.dns.multicast.use_group_ip
        });
        mdns.on('error', err => {
            winston.error(err.message || typeof err === 'string' ? err : JSON.stringify(err));
        });
        mdns.on('warning', err => {
            winston.error(err.message || typeof err === 'string' ? err : JSON.stringify(err));
        });
        mdns.on('query', (query, rinfo) => {
            winston.log('debug', 'recv mdns query =>\n' + JSON.stringify(rinfo) + '\n' + JSON.stringify(query));
            const web_ui_query = {
                questions: []
            };
            const peer_api_query = {
                questions: []
            };
            query.questions.forEach(q => {
                if (q.type === 'SRV' || q.type === 'TXT' || q.type === 'ANY') {
                    if (q.name.match(web_ui_name_pattern)) {
                        web_ui_query.questions.push(q);
                    }
                    if (q.name.match(peer_api_name_pattern)) {
                        peer_api_query.questions.push(q);
                    }
                }
            });
            if (peer_api_query.questions.length > 0) {
                peer_api_query.questions.forEach(q => {
                    const answers = self.query({
                        caller: rinfo,
                        query: q
                    }, false);
                    if (answers.length > 0) {
                        mdns.respond({
                            type: 'response',
                            questions: [q],
                            answers: answers
                        }, rinfo);
                    }
                });
            }
            if (web_ui_query.questions.length > 0) {
                web_ui_query.questions.forEach((q, i) => {
                    const answers = self.query({
                        caller: rinfo,
                        query: q
                    }, true);
                    if (answers.length > 0) {
                        mdns.respond({
                            type: 'response',
                            questions: [q],
                            answers: answers
                        }, rinfo);
                    }
                });
            }
        });
    };

    const id_match = (suffix, id, uri) => {
        return uri.length > suffix.length + 2 && id.indexOf(uri.substr(0, uri.length - suffix.length)) === 0;
    };

    const relevance_order = (address) => {
        if (interfaces.length < 2) {
            return interfaces;
        } else {
            const lst = [];
            interfaces.forEach(i => {
                const n1 = address.split('.').map(a => a.trim());
                const n2 = i.split('.').map(a => a.trim());
                let rel = 0;
                for (let i = 0; i < Math.min(n1, length, n2.length); i++) {
                    if (n1[i].toLowerCase() === n2[i].toLowerCase()) {
                        rel++;
                    } else {
                        break;
                    }
                }
                if (rel > 0) {
                    lst.push({
                        rel: rel,
                        address: i
                    });
                }
            });
            return lst.sort((a, b) => a.rel > b.rel ? -1 : a.rel < b.rel ? 1 : 0).map(a => a.address);
        }
    };

    self.query = (msg, is_http) => {
        if (config.dns && config.dns.multicast && !config.dns.multicast.service.disabled) {
            const suffix = is_http ? '.ui.media.local' : '.peer.media.local';
            const caller = msg.caller;
            const _ifs = relevance_order(caller.address);
            if (_ifs.length > 0 && (msg.query.type === 'ANY' || msg.query.type === 'SRV' || msg.query.type === 'TXT')) {
                return [{
                    type: msg.query.type,
                    name: (config.server_name ? config.server_name : '') + suffix,
                    ttl: config.dns.multicast.cache_seconds,
                    data: msg.query.type === 'TXT' ? JSON.stringify({
                        auth: false,
                        descr: '1-net media server'
                    }) : {
                        port: is_http ? global.web_server.port : global.feed_server.port,
                        target: _ifs.toString(),
                        weight: 0,
                        priority: 0
                    }
                }];
            } else {
                return [];
            }
        }
    };
};

const client = function (opts) {
    const self = this;
    opts = opts || {
        loopback: true
    };
    self.query = (name, type) => {
        type = type || 'SRV';
        const re_query = (name, type) => {
            return new B((resolve, reject) => {
                const question = {
                    type: type,
                    name: name
                };
                const mdns = new mdns_api({
                    port: 0,
                    subnets: opts.subnets || config.dns.multicast.subnets,
                    loopback: !!opts.loopback,
                    client_only: true
                });
                mdns.on('error', err => {
                    winston.error(err.message || typeof err === 'string' ? err : JSON.stringify(err));
                });
                let __timeout = setTimeout(() => {
                    resolve();
                    clearTimeout(__timeout);
                    mdns.destroy();
                    mdns.removeListener('response', res_handler);
                    mdns.removeAllListeners('error');
                    __timeout = undefined;
                    winston.log('silly', 'query timeout ...');
                }, 1000 * (opts.expire_seconds || 1));
                const res_handler = res => {
                    winston.log('debug', JSON.stringify(res));
                    if (res.type === 'response') {
                        if (res.questions.length > 0 && res.questions[0].type === question.type && res.questions[0].name === question.name) {
                            if (__timeout) {
                                clearTimeout(__timeout);
                                __timeout = undefined;
                            }
                            mdns.destroy();
                            setTimeout(() => {
                                mdns.removeListener('response', res_handler);
                                mdns.removeAllListeners('error');
                            }, 100);
                            if (res.answers && res.answers.length > 0 || res.additionals && res.additionals.length > 0) {
                                if (res.answers && res.answers.length > 0) {
                                    if (typeof res.answers[0].data === 'string') {
                                        resolve({
                                            ips: res.answers[0].data,
                                            total: res.answers.length
                                        });
                                    } else {
                                        resolve({
                                            ips: res.answers[0].data.target,
                                            port: res.answers[0].data.port,
                                            total: res.answers.length
                                        });
                                    }
                                } else if (res.additionals && res.additionals.length > 0) {
                                    if (typeof res.additionals[0].data === 'string') {
                                        resolve({
                                            ips: res.additionals[0].data,
                                            total: res.additionals.length
                                        });
                                    } else {
                                        resolve({
                                            ips: res.additionals[0].data.target,
                                            port: res.additionals[0].data.port,
                                            total: res.additionals.length
                                        });
                                    }
                                }
                            } else {
                                resolve();
                            }
                        }
                    }
                };
                mdns.on('response', res_handler);
                mdns.on('ready', () => {
                    mdns.query({
                        questions: [question]
                    });
                });
            });
        };
        const now = (new Date()).getTime();
        return sqlite.find({
            table: "local_mdns_cache",
            predicate: '"name"=\'' + name + '\' AND "type"=\'' + type + '\''
        }).then(rec => {
            const cache_seconds = config.dns.multicast.cache_seconds || 3;
            if (rec && (now - rec.create_date) < 1000 * cache_seconds) {
                if (rec.data) {
                    if (type === 'SRV') {
                        rec.data = JSON.parse(rec.data);
                        return {
                            ips: rec.data.ips,
                            port: rec.data.port,
                            total: rec.data.total
                        }
                    } else {
                        return {
                            ips: rec.data.ips,
                            total: rec.data.total
                        }
                    }
                } else {
                    return undefined;
                }
            } else {
                return re_query(name, type).then(dns_rec => {
                    if (dns_rec) {
                        return sqlite.add_or_update({
                            table: 'local_mdns_cache',
                            iids: {
                                name: name,
                                type: type
                            },
                            rec: {
                                name: name,
                                type: type,
                                create_date: now,
                                data: type === 'SRV' ? JSON.stringify(dns_rec) : dns_rec
                            }
                        }).then(() => {
                            if (type === 'SRV') {
                                return {
                                    ips: dns_rec.ips,
                                    port: dns_rec.port,
                                    total: dns_rec.total
                                }
                            } else {
                                return {
                                    ips: dns_rec.ips,
                                    total: dns_rec.total
                                }
                            }
                        });
                    } else {
                        return sqlite.add_or_update({
                            table: 'local_mdns_cache',
                            iids: {
                                name: name,
                                type: type
                            },
                            rec: {
                                name: name,
                                type: type,
                                create_date: now
                            }
                        }).then(() => null);
                    }
                });
            }
        });
    }
};

module.exports = {
    service: service,
    client: client
};