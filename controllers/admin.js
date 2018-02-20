'use strict';

const
    router = require('express').Router(),
    winston = require('winston'),
    B = require('bluebird'),
    config = require(__dirname + '/../config/config'),
    sqlite = require(__dirname + '/../lib/sqlite-api'),
    i18n = require(__dirname + '/../lib/i18n-api');

router.post('/add-endpoint-rule', (req, res) => {
    const rec = {
        policy_id: req.body.policy_id,
        endpoint_id: req.body.endpoint_id,
        white_listed: req.body.white_listed,
        disabled: false
    };
    sqlite.add_or_update({
        table: 'access_endpoints',
        iids: {
            policy_id: req.body.policy_id,
            endpoint_id: req.body.endpoint_id,
            white_listed: req.body.white_listed
        },
        rec: rec
    }).then(_id => {
        res.json({
            ok: true,
            id: _id
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/set-endpoint-rule-disable', (req, res) => {
    const rec = {
        disabled: req.body.disabled
    };
    sqlite.add_or_update({
        table: 'access_endpoints',
        iids: {
            policy_id: req.body.policy_id,
            endpoint_id: req.body.endpoint_id,
            white_listed: req.body.white_listed
        },
        rec: rec
    }).then(() => {
        res.json({
            ok: true
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/remove-endpoint-rule', (req, res) => {
    sqlite.remove({
        table: 'access_endpoints',
        iids: {
            policy_id: req.body.policy_id,
            endpoint_id: req.body.endpoint_id,
            white_listed: req.body.white_listed
        }
    }).then(() => {
        res.json({
            ok: true
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/add-role-rule', (req, res) => {
    const rec = {
        policy_id: req.body.policy_id,
        role_id: req.body.role_id,
        disabled: false
    };
    sqlite.add_or_update({
        table: 'access_roles',
        iids: {
            policy_id: req.body.policy_id,
            role_id: req.body.role_id
        },
        rec: rec
    }).then(_id => {
        res.json({
            ok: true,
            id: _id
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/set-role-rule-disable', (req, res) => {
    const rec = {
        disabled: req.body.disabled
    };
    sqlite.add_or_update({
        table: 'access_roles',
        iids: {
            policy_id: req.body.policy_id,
            role_id: req.body.role_id
        },
        rec: rec
    }).then(() => {
        res.json({
            ok: true
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/remove-role-rule', (req, res) => {
    sqlite.remove({
        table: 'access_roles',
        iids: {
            policy_id: req.body.policy_id,
            role_id: req.body.role_id
        }
    }).then(() => {
        res.json({
            ok: true
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/add-user-role', (req, res) => {
    const rec = {
        user_id: req.body.user_id,
        role_id: req.body.role_id,
        disabled: false
    };
    sqlite.add_or_update({
        table: 'user_roles',
        iids: {
            user_id: req.body.user_id,
            role_id: req.body.role_id
        },
        rec: rec
    }).then(_id => {
        res.json({
            ok: true,
            id: _id
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/set-user-role-disable', (req, res) => {
    const rec = {
        disabled: req.body.disabled
    };
    sqlite.add_or_update({
        table: 'user_roles',
        iids: {
            user_id: req.body.user_id,
            role_id: req.body.role_id
        },
        rec: rec
    }).then(() => {
        res.json({
            ok: true
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/remove-user-role', (req, res) => {
    sqlite.remove({
        table: 'user_roles',
        iids: {
            user_id: req.body.user_id,
            role_id: req.body.role_id
        }
    }).then(() => {
        res.json({
            ok: true
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/update-node-label', (req, res) => {
    return sqlite.add_or_update({
        table: 'settings',
        iids: {
            name: 'node_label'
        },
        rec: {
            name: 'node_label',
            value: req.body.node_label
        }
    }).then(() => {
        res.json({
            ok: true
        });
    }).catch(err => {
        res.json({
            ok: false,
            error: typeof err === 'string' ? err : (err.message ? err.message : JSON.stringify(err))
        });
    });
});

router.post('/load-data', (req, res) => {
    const ret = {};
    sqlite.all({
        table: 'policies'
    }).then(policies => {
        ret.policies = policies;
        ret.policies.forEach(p => {
            switch (p.id) {
                case 'guest':
                    p.label = i18n.__t(req.locale, 'adb831a7fdd83dd1e2a309ce7591dff8' /*Guest*/ );
                    p.descr = i18n.__t(req.locale, '886b6585e547ef5e551832d300115173' /*This is the security profile applied to an site entities that a guest with lowest priviledge can operate.*/ );
                    break;
                case 'default':
                    p.label = i18n.__t(req.locale, '7a1920d61156abc05a60135aefe8bc67' /*Default*/ );
                    p.descr = i18n.__t(req.locale, '7b67f4aec7ef5734c5b3e043c0fda1d4' /*This is the default security profile applied to gateway access operations that require use and/or endpoint authorization.*/ );
                    break;
                case 'admin':
                    p.label = i18n.__t(req.locale, '7258e7251413465e0a3eb58094430bde' /*Administration*/ );
                    p.descr = i18n.__t(req.locale, 'f7f558da6199666d1d1e53b74a979b25' /*This is the security profile applied to administative operations base on use and/or endpoint identification.*/ );
                    break;
            }
        });
        return B.all(policies.map(p => {
            return sqlite.all({
                table: 'access_endpoints',
                predicate: '"policy_id"=\'' + p.id + '\''
            }).then(eps => {
                p.endpoints = eps;
                return sqlite.all({
                    table: 'access_roles',
                    predicate: '"policy_id"=\'' + p.id + '\''
                }).then(rs => {
                    p.roles = rs;
                });
            });
        }));
    }).then(() => {
        return sqlite.all({
            table: 'users'
        }).then(us => {
            ret.users = us;
        }).then(() => {
            return sqlite.all({
                table: 'roles'
            }).then(rs => {
                ret.roles = rs;
                ret.policies.forEach(p => {
                    p.roles.forEach(rl => {
                        const r = rs.find(_r => _r.id === rl.role_id);
                        if (r) {
                            rl.name = r.name;
                        }
                    });
                })
            });
        }).then(() => {
            return sqlite.all({
                table: 'user_roles'
            }).then(urs => {
                urs.forEach(ur => {
                    (() => {
                        const u = ret.users.find(_u => _u.id === ur.user_id);
                        if (u) {
                            u.roles = u.roles || [];
                            const r = ret.roles.find(r => r.id === ur.role_id);
                            if (r) {
                                const _ur = {};
                                Object.keys(ur).forEach(k => {
                                    _ur[k] = ur[k];
                                });
                                _ur.rolename = r.name;
                                u.roles.push(_ur);
                            }
                        }
                    })();
                    (() => {
                        const r = ret.roles.find(_r => _r.id === ur.role_id);
                        if (r) {
                            r.users = r.users || [];
                            const u = ret.users.find(u => u.id === ur.user_id);
                            if (u) {
                                const _ru = {};
                                Object.keys(ur).forEach(k => {
                                    _ru[k] = ur[k];
                                });
                                _ru.username = u.username;
                                r.users.push(_ru);
                            }
                        }
                    })();
                });
            });
        });
    }).then(() => {
        return sqlite.all({
            table: 'endpoints'
        }).then(endpoints => {
            ret.current_epid = req.user.eid;
            ret.endpoints = endpoints;
        });
    }).then(() => {
        return sqlite.find({
            table: 'settings',
            predicate: '"name"=\'node_label\''
        }).then(lb => {
            if (lb)
                ret.node_label = lb.value;
            ret.ok = true;
        });
    }).catch(err => {
        ret.ok = false;
        ret.error = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
    }).finally(() => {
        res.json(ret);
    });
});

router.get('/', (req, res) => {
    const client_mode = global.client_mode;
    res.render('admin.html', {
        title_ex: global.node_label + (global.target_endpoint ? ' (' + global.target_endpoint.name + ')' : ''),
        node_label: global.node_label,
        target_name: global.target_endpoint ? global.target_endpoint.name : undefined,
        allow_any: config.target.allowAllUsers,
        gw_web_path: config.target.virtualPath + '-front',
        gw_console_path: config.target.virtualPath + '-console',
        login: req.isAuthenticated() ? req.user : undefined,
        client_mode: client_mode ? client_mode : ''
    });
});

module.exports = router;