'use strict';

const
    _ = require('lodash'),
    path = require('path'),
    https = require('https'),
    http_req = require('request'),
    uuid = require('uuid'),
    crypto = require('crypto'),
    B = require('bluebird'),
    i18n = require(__dirname + '/i18n-api');

const Authenticator = function () {
    const self = this;
    const config = Authenticator.config;
    const userStore = Authenticator.userStore;

    let authHost = config.vnet.endponts.baseUrl.substr('https://'.length);
    let authPort = 443;

    if (authHost.indexOf(':') !== -1) {
        authPort = parseInt(authHost.substr(authHost.indexOf(':') + 1));
        authHost = authHost.substr(0, authHost.indexOf(':'));
    }

    const agentOptions = {
        host: authHost,
        port: authPort,
        path: config.vnet.endponts.token.apiPath,
        rejectUnauthorized: !config.debugMode
    };

    const authAgent = new https.Agent(agentOptions);

    const isInRole = (req, roles) => {
        return req.user && (!roles || roles.length === 0 || roles && req.user.roles && _.intersection(_.map(req.user.roles, r => {
            return r.name.toLowerCase();
        }), _.map(roles, r => {
            return r.name.toLowerCase();
        })).length > 0);
    };

    const isEndpointAllowed = (req, endpoints) => {
        if (!endpoints) {
            return {
                ok: true
            };
        } else if (endpoints.blacklist && _.find(endpoints.blacklist, ep => {
                return ep.id === req.session.endpoint;
            })) {
            return {
                ok: false,
                reason: i18n.__t(req.locale, '722969577a96ca3953e84e3d949dee81' /*Forbidden*/ ) //'forbidden'
            };
        }
        if (!endpoints.blacklist) {
            const ok = endpoints.whitelist && _.find(endpoints.whitelist, ep => {
                return ep.id === req.session.endpoint;
            });
            return {
                ok: ok,
                reason: ok ? undefined : i18n.__t(req.locale, '11a4acb42e865c86a548826d6ae5d4d9' /*Not Authorized*/ ) //'not_authorized'
            };
        } else {
            const ok = !endpoints.whitelist || endpoints.whitelist && _.find(endpoints.whitelist, ep => {
                return ep.id === req.session.endpoint;
            });
            return {
                ok: ok,
                reason: ok ? undefined : i18n.__t(req.locale, '11a4acb42e865c86a548826d6ae5d4d9' /*Not Authorized*/ ) //'not_authorized'
            };
        }
    };

    const encodeState = state => {
        let aes = crypto.createCipher('aes-256-cbc', config.authKey);
        return aes.update(JSON.stringify(state), 'utf8', 'base64') + aes.final('base64');
    };

    const decodeState = state => {
        let aes = crypto.createDecipher('aes-256-cbc', config.authKey);
        let json = aes.update(state, 'base64', 'utf8') + aes.final('utf8');
        return JSON.parse(json);
    };

    const domainUrl = req => {
        //console.log(config.accessProtocol + '://' + req.headers['host'] + (config.accessPort ? ':' + config.accessPort : ''));
        return config.accessProtocol + '://' + req.headers['host'] + (config.accessPort ? ':' + config.accessPort : '');
    };

    self.check = (opts) => {
        return (req, res, next) => {
            let policyId;
            if (typeof opts === 'object') {
                policyId = opts.policyId ? opts.policyId : 'default';
            } else {
                policyId = opts ? opts : 'default';
            }
            userStore.getAccessControl(policyId).then((policy) => {
                if (!req.isAuthenticated()) {
                    const state = {
                        tid: uuid.v4(),
                        returnTo: domainUrl(req) + req.originalUrl
                    };
                    req.session['oauth-login-state'] = state;
                    let cstate = encodeState(state);
                    let authUrl = _.trimEnd(config.vnet.endponts.baseUrl, '/') + '/' + _.trimStart(config.vnet.endponts.authorize.apiPathFmt.replace(/\{0\}/, config.viewType), '/');
                    authUrl += '?response_type=code';
                    authUrl += '&client_id=' + encodeURIComponent(config.vnet.clientId);
                    authUrl += '&redirect_uri=' + encodeURIComponent(domainUrl(req) + config.returnPath);
                    authUrl += '&scope=' + encodeURIComponent(_.join(config.vnet.scope, ' '));
                    authUrl += '&state=' + encodeURIComponent(cstate);
                    if (!config.authFramePath || opts && opts.fullPage) {
                        res.redirect(authUrl);
                    } else {
                        res.render(config.authFramePath, {
                            url: authUrl
                        });
                    }
                } else if (policy && !isInRole(req, policy.roles)) {
                    next({
                        auth_failed: true,
                        fail_type: 'do_not_has_proper_role',
                        reason: i18n.__t(req.locale, '83a9004e31985342b116df75df815b48' /*Not in a proper role.*/ ), // 'not_in_role',
                        msg: i18n.__t(req.locale, 'ac5d3f7e118c524cee57f353c35b5e72', policy.roles.map(r => r.name).join(', ')) //One need to acquire one of the roles: [%s] in order to access the page.
                    });
                } else if (policy && !isEndpointAllowed(req, policy.endpoints).ok) {
                    let msg = '<p>' + i18n.__t(req.locale, '6d867742a17a8680fce98e1c9287c365' /*The current endpoint is not allowed to access the page.*/ );
                    msg += i18n.__t(req.locale, '11c1619c7ea7541a70bd0e68926e6ee2' /*Please use one of the following browser:*/ ) + '</p>';
                    let lst_msg = '<ul>';
                    lst_msg = _.chain(policy.endpoints.whitelist).filter(e => !policy.endpoints.blacklist || !policy.blacklist.find(_e => _e.id === e.id)).reduce((m, e) => {
                        return m + '<li>' + '    (' + e.id + ') ' + (e.domain ? e.domain + '::' : '') + ' => ' + (e.name ? e.host + '::' + e.name : e.host) + '</li>';
                    }, lst_msg).value();
                    lst_msg += '</ul>';
                    next({
                        auth_failed: true,
                        fail_type: 'end_point_access_not_allowed',
                        reason: isEndpointAllowed(req, policy.endpoints).reason,
                        html_msg: msg + lst_msg
                    });
                } else {
                    const now = new Date();
                    if (!req.session.last_auth || now.getTime() - req.session.last_auth < 1000 * config.sec_policy.sessionExpireSeconds) {
                        req.session.last_auth = now.getTime();
                        const refreshAt = new Date(req.user.refresh);
                        if (now > refreshAt) {
                            self.refresh(req.session.user.refId).then(tkWrap => {
                                tkWrap.token = JSON.parse(new Buffer(tkWrap.access_token, 'base64').toString('utf8'));
                                if (!tkWrap.refresh_token)
                                    tkWrap.refresh_token = req.session.user.refId;
                                return userStore.updateToken(req, tkWrap).then(() => {
                                    let expires = new Date((new Date(tkWrap.token.content.date)).getTime() + 1000 * tkWrap.token.content.expires_in);
                                    req.session.user.refresh = expires.getTime();
                                    req.user = req.session.user;
                                    next();
                                });
                            }).catch(err => {
                                console.log('token refresh error:');
                                console.log(err);
                                self.logout(req, res);
                            }).done();
                        } else {
                            next();
                        }
                    } else {
                        console.log('login session expired ...');
                        self.logout(req, res);
                    }
                }
            });
        };
    };

    self.login = (req, authInfo) => {
        let expires = new Date((new Date(authInfo.auth.access_token.content.date)).getTime() + 1000 * authInfo.auth.access_token.content.expires_in);
        req.session.user = {
            id: authInfo.user.userId,
            name: authInfo.user.displayName,
            userName: authInfo.user.username,
            eid: authInfo.auth.access_token.endpointId,
            refId: authInfo.auth.refresh_token,
            refresh: expires.getTime()
        };
        req.session.endpoint = authInfo.auth.access_token.endpointId;
        req.session.scope = authInfo.auth.access_token.content.scope;
        req.session.last_auth = (new Date()).getTime();
        return userStore.mapUser(req, authInfo).then(user_eps => {
            console.log(`other login endpoints: [${user_eps.map(e=>e.endpoint_id).join(',')}]`);
        });
    };

    self.logout = (req, res) => {
        return userStore.unmapUser(req.user).then(() => {
            req.session.user = undefined;
            req.session.endpoint = undefined;
            req.session.scope = undefined;
            req.user = undefined;
            let logoutUrl = _.trimEnd(config.vnet.endponts.baseUrl, '/') + '/' + _.trimStart(config.vnet.endponts.user.apiPath, '/') + '/logout';
            logoutUrl += '?returnUrl=' + encodeURIComponent(domainUrl(req) + '/');
            res.redirect(logoutUrl);
        });
    };

    self.refresh = (refreshToken) => {
        return new B((resolve, reject) => {
            const callOpts = {
                url: _.trimEnd(config.vnet.endponts.baseUrl, '/') + '/' + _.trimStart(config.vnet.endponts.token.apiPath, '/'),
                method: 'POST',
                agent: authAgent,
                json: {
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: config.vnet.clientId,
                    client_secret: config.vnet.clientSecret
                }
            };
            http_req(callOpts, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    resolve(body);
                } else {
                    if (response)
                        reject({
                            err: error,
                            httpCode: response.statusCode,
                            msg: body
                        });
                    else
                        reject({
                            err: error,
                            httpCode: -1
                        });
                }
            });
        });
    };

    self.callback = req => {
        const state = decodeState(req.query.state);
        const promise = new B((resolve, reject) => {
            let code = req.query.code;
            let old_state = req.session['oauth-login-state'];
            req.session['oauth-login-state'] = undefined;
            if (!old_state || old_state.tid !== state.tid) {
                reject(new Error('state mismatch'));
            } else {
                const callOpts = {
                    url: _.trimEnd(config.vnet.endponts.baseUrl, '/') + '/' + _.trimStart(config.vnet.endponts.token.apiPath, '/'),
                    method: 'POST',
                    agent: authAgent,
                    json: {
                        grant_type: 'authorization_code',
                        code: req.query.code,
                        redirect_uri: domainUrl(req) + config.returnPath,
                        client_id: config.vnet.clientId,
                        client_secret: config.vnet.clientSecret
                    }
                };
                http_req(callOpts, (error, response, body) => {
                    if (!error && response.statusCode === 200) {
                        resolve(body);
                    } else {
                        if (response)
                            reject({
                                err: error,
                                httpCode: response.statusCode,
                                msg: body
                            });
                        else
                            reject({
                                err: error,
                                httpCode: -1
                            });
                    }
                });
            }
        }).then(oauth2Token => {
            return new B((resolve, reject) => {
                const accToken = JSON.parse(new Buffer(oauth2Token.access_token, 'base64').toString('utf8'));
                oauth2Token.access_token = accToken;
                const callOpts = {
                    url: _.trimEnd(config.vnet.endponts.baseUrl, '/') + '/' + _.trimStart(config.vnet.endponts.user.apiPath, '/'),
                    method: 'POST',
                    agent: authAgent,
                    headers: {
                        'Accept-Language': req.headers['accept-language']
                    },
                    json: {
                        uid: accToken.userId,
                        eid: accToken.endpointId,
                        client_id: config.vnet.clientId,
                        client_secret: config.vnet.clientSecret
                    }
                };
                http_req(callOpts, (error, response, userDetails) => {
                    if (!error && response.statusCode === 200) {
                        resolve({
                            ok: true,
                            auth: oauth2Token,
                            user: userDetails,
                            returnTo: state.returnTo
                        });
                    } else {
                        if (response)
                            reject({
                                ok: false,
                                err: error,
                                httpCode: response.statusCode,
                                msg: userDetails
                            });
                        else
                            reject({
                                ok: false,
                                err: error,
                                httpCode: -1
                            });
                    }
                });
            });
        }).then(record => {
            return new B((resolve, reject) => {
                let callOpts = {
                    url: _.trimEnd(config.vnet.endponts.baseUrl, '/') + '/' + _.trimStart(config.vnet.endponts.endpoint.apiPath, '/'),
                    method: 'POST',
                    agent: authAgent,
                    headers: {
                        'Accept-Language': req.headers['accept-language']
                    },
                    json: {
                        uid: record.auth.access_token.userId,
                        eid: record.auth.access_token.endpointId,
                        max_access_points: 30,
                        client_id: config.vnet.clientId,
                        client_secret: config.vnet.clientSecret
                    }
                };
                http_req(callOpts, (error, response, endpoint) => {
                    if (!error && response.statusCode === 200) {
                        record.endpoint = endpoint;
                        resolve(record);
                    } else {
                        if (response)
                            reject({
                                err: error,
                                httpCode: response.statusCode,
                                msg: endpoint
                            });
                        else
                            reject({
                                err: error,
                                httpCode: -1
                            });
                    }
                });
            });
        });
        return promise;
    };

    self.supplyDefaultAdmin = req => {
        return userStore.setDefaultAdmin(req.session.user);
    };
};

Authenticator.initialize = (app, config, userStore) => {
    Authenticator.config = config;
    Authenticator.userStore = userStore;
    app.use((req, res, next) => {
        req.isAuthenticated = () => {
            if (!req.user && req.session && req.session.user) {
                req.user = req.session.user;
            }
            return req.user ? true : false;
        };
        next();
    });
};

module.exports = Authenticator;