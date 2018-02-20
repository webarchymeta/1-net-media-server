'use strict';

const
    _ = require('lodash'),
    path = require('path'),
    B = require('bluebird'),
    sqlite = require(__dirname + '/../lib/sqlite-api'),
    config = require(__dirname + '/../config/config');

const fromJsonDate = val => {
    if (!val)
        return undefined;
    let tv = val.substr(6);
    tv = tv.substr(0, tv.length - 2);
    return parseInt(tv);
};

const userStore = function () {
    const self = this;
    self.mapUser = (req, authInfo) => {
        const user = {
            id: authInfo.user.userId,
            username: authInfo.user.username,
            authenticated: true,
            details: JSON.stringify(authInfo.user)
        };
        return sqlite.add_or_update({
            table: "users",
            iids: {
                id: user.id
            },
            rec: user
        }).then(() => {
            const ep = {
                id: authInfo.endpoint.id,
                domain: authInfo.endpoint.domain,
                host: authInfo.endpoint.host,
                name: authInfo.endpoint.name,
                platform: authInfo.endpoint.platform,
                platformIcon: authInfo.endpoint.platformIcon,
                browser: authInfo.endpoint.browser,
            };
            return sqlite.add_or_update({
                table: "endpoints",
                iids: {
                    id: ep.id
                },
                rec: ep
            }).then(() => {
                const uep = {
                    user_id: user.id,
                    endpoint_id: ep.id,
                    createdDate: fromJsonDate(authInfo.endpoint.createdDate),
                    lastActive: fromJsonDate(authInfo.endpoint.lastActive),
                    details: JSON.stringify(authInfo.endpoint)
                };
                return sqlite.add_or_update({
                    table: "user_endpoints",
                    iids: {
                        user_id: user.id,
                        endpoint_id: ep.id
                    },
                    rec: uep
                });
            }).then(() => {
                const add = i => {
                    const ap = authInfo.endpoint.accessPoints[i];
                    const uap = {
                        ip: ap.ip,
                        user_id: user.id,
                        endpoint_id: ep.id,
                        type: ap.type,
                        first: fromJsonDate(ap.first),
                        active: fromJsonDate(ap.active),
                        count: ap.count
                    };
                    return sqlite.add_or_update({
                        table: "user_access_points",
                        iids: {
                            ip: ap.ip
                        },
                        rec: uap
                    }).then(() => {
                        if (i < authInfo.endpoint.accessPoints.length - 1)
                            return add(i + 1);
                    });
                };
                return add(0);
            });
        }).then(() => {
            const atk = {
                id: authInfo.auth.access_token.id,
                user_id: authInfo.user.userId,
                endpoint_id: authInfo.endpoint.id,
                refresh_token: authInfo.auth.refresh_token,
                encoding: authInfo.auth.encoding,
                create_at: (new Date()).getTime(),
                expires_in: authInfo.auth.expires_in,
                scope: authInfo.auth.scope.toString(),
                token_type: authInfo.auth.token_type,
                access_token: JSON.stringify(authInfo.auth.access_token)
            };
            return sqlite.add_or_update({
                table: "access_tokens",
                iids: {
                    id: atk.id
                },
                rec: atk
            }).catch(ex => {
                console.log(ex);
            });
        }).then(() => {
            const sql = `select r."id", r."name" from "roles" as r Inner Join "users" as u Inner Join "user_roles" as l On r."id"=l."role_id" And u."id"=l."user_id"
            where u."id"='${authInfo.user.userId}' And l."disabled"=0;`;
            return sqlite.all(sql).then(roles => {
                req.session.user.roles = roles;
                const sql2 = `select distinct "endpoint_id" from "access_tokens" as tk where tk."user_id"='${authInfo.user.userId}' And "endpoint_id"<>'${authInfo.endpoint.id}'`;
                return sqlite.all(sql2).then(_epids => {
                    return _epids;
                });
            });
        });
    };

    self.updateToken = (req, tkWrap) => {
        const atk = {
            id: tkWrap.token.id,
            user_id: tkWrap.token.userId,
            endpoint_id: tkWrap.token.endpointId,
            refresh_token: tkWrap.refresh_token,
            encoding: tkWrap.encoding,
            create_at: (new Date()).getTime(),
            expires_in: tkWrap.expires_in,
            scope: tkWrap.scope.toString(),
            token_type: tkWrap.token_type,
            access_token: JSON.stringify(tkWrap.token.content)
        };
        return sqlite.add_or_update({
            table: "access_tokens",
            iids: {
                id: atk.id
            },
            rec: atk
        });
    };

    self.unmapUser = user => {
        return sqlite.remove({
            table: "access_tokens",
            iids: {
                user_id: user.id,
                endpoint_id: user.eid
            }
        });
    };

    self.getAccessControl = policyId => {
        const rsql = `Select r."id", r."name" from "policies" as po Inner Join "access_roles" as a On po."id"=a."policy_id" 
            Inner Join "roles" as r On a."role_id"=r."id"
            Where po."id"='${policyId}' And a."disabled"=0;`;
        const esql = `Select e."id", e."domain", e."host", e."name", a."white_listed" from "policies" as po Inner Join "access_endpoints" as a On po."id"=a."policy_id"
            Inner Join "endpoints" as e On a."endpoint_id"=e."id"
            Where po."id"='${policyId}' And a."disabled"=0;`;
        return B.all([sqlite.all(rsql), sqlite.all(esql)]).then(recs => {
            let whitelist = recs[1].filter(r => r.white_listed == 1);
            let blacklist = recs[1].filter(r => r.white_listed == 0);
            if (whitelist.length == 0)
                whitelist = undefined;
            if (blacklist.length == 0)
                blacklist = undefined;
            if (config.target.allowAllUsers && policyId === 'default') {
                recs[0] = undefined;
            }
            return {
                roles: recs[0] && recs[0].length > 0 ? recs[0] : undefined,
                endpoints: blacklist || whitelist ? {
                    blacklist: blacklist,
                    whitelist: whitelist
                } : undefined
            };
        });
    };

    self.setDefaultAdmin = user => {
        const sql = `select "id" from "users" where "id"<>'${user.id}';`
        let first_user = false;
        return sqlite.all(sql).then(users => {
            first_user = users.length === 0;
            if (first_user) {
                const sql = `select r."name" from "users" as u Inner Join "user_roles" as ur On u."id"=ur."user_id" Inner Join "roles" as r On r."id"=ur."role_id" where r."id"=1;`
                return sqlite.all(sql).then(roles => {
                    if (roles.length === 0) {
                        const rec1 = {
                            user_id: "'" + user.id + "'",
                            role_id: 1
                        };
                        return sqlite.add_or_update({
                            table: "user_roles",
                            iids: {
                                user_id: user.id,
                                role_id: 1
                            },
                            rec: rec1
                        }).then(() => {
                            user.roles = [{
                                id: 1,
                                name: 'admin'
                            }];
                            if (!config.target.allowAllUsers) {
                                const rec2 = {
                                    user_id: "'" + user.id + "'",
                                    role_id: 3
                                };
                                return sqlite.add_or_update({
                                    table: "user_roles",
                                    iids: {
                                        user_id: user.id,
                                        role_id: 3
                                    },
                                    rec: rec2
                                }).then(() => {
                                    user.roles.push({
                                        id: 3,
                                        name: 'gateway-access'
                                    });
                                });
                            }
                        });
                    }
                }).then(() => {
                    const sql = `select ae."id" from "access_endpoints" as ae Inner join "user_endpoints" as ue On ae."endpoint_id"=ue."endpoint_id" where ue."user_id"='${user.id}'
                    And ae."policy_id"='admin' And ae."disabled"=0 And ae."white_listed"=1;`;
                    return sqlite.all(sql).then(aes => {
                        if (aes.length === 0) {
                            const rec = {
                                policy_id: 'admin',
                                endpoint_id: user.eid,
                                white_listed: true,
                                disabled: false
                            };
                            return sqlite.add_or_update({
                                table: "access_endpoints",
                                iids: {
                                    policy_id: 'admin',
                                    endpoint_id: user.eid
                                },
                                rec: rec
                            });
                        }
                    });
                });
            }
        });
    };
};

module.exports = userStore;