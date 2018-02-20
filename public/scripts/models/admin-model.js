const endpoint_link = function (p, data, is_curr) {
    const self = this;
    const parent = p;
    self.id = data ? data.id : undefined;
    self.endpoint_id = ko.observable(data ? data.endpoint_id : '');
    self.white_listed = ko.observable(data ? !!data.white_listed : true);
    self.disabled = ko.observable(data ? !!data.disabled : false);
    self.disabled.subscribe(bval => {
        fetch('/admin/set-endpoint-rule-disable', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                policy_id: parent.id,
                endpoint_id: self.endpoint_id(),
                white_listed: self.white_listed(),
                disabled: bval
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {

            } else {
                alert(ret.error);
            }
        });
    });
    self.is_current = !!is_curr;

    self.remove = () => {
        parent.remove_ep(self);
    };
}

const role_link = function (p, data) {
    const self = this;
    const parent = p;
    self.id = data.id;
    self.role_id = data.role_id;
    self.name = data.name;
    self.disabled = ko.observable(data ? !!data.disabled : false);
    self.disabled.subscribe(bval => {
        fetch('/admin/set-role-rule-disable', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                policy_id: parent.id,
                role_id: self.role_id,
                disabled: bval
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {

            } else {
                alert(ret.error);
            }
        });
    });

    self.remove = () => {
        parent.remove_role(self);
    };
};

const policy = function (p, data) {
    const self = this;
    const parent = p;
    self.id = data.id;
    self.name = data.name;
    self.label = data.label;
    self.descr = data.descr;
    self.endpoints = ko.observableArray();
    data.endpoints.forEach(ep => {
        self.endpoints.push(new endpoint_link(self, ep, ep.endpoint_id === parent.current_endpoint.id));
    });
    self.roles = ko.observableArray();
    data.roles.forEach(r => {
        self.roles.push(new role_link(self, r));
    });

    self.adding_allowed_ep = ko.observable(false);
    self.adding_disallowed_ep = ko.observable(false);
    self.adding_allowed_role = ko.observable(false);

    self.numb_allowed_endpoints = ko.observable(0);
    self.allowed_endpoints = ko.computed(() => {
        const arr = self.endpoints().filter(e => e.white_listed());
        self.numb_allowed_endpoints(arr.length);
        return arr;
    });
    self.numb_disallowed_endpoints = ko.observable(0);
    self.disallowed_endpoints = ko.computed(() => {
        const arr = self.endpoints().filter(e => !e.white_listed());
        self.numb_disallowed_endpoints(arr.length);
        return arr;
    });

    self.all_endpoints_allowed = ko.computed(() => {
        return !self.endpoints() || self.endpoints().length === 0 || self.endpoints().filter(e => !e.disabled() && e.white_listed()).length === 0;
    });

    self.allowed_availables = ko.computed(() => {
        const curr_eps = self.endpoints().filter(e => e.white_listed());
        return parent.known_endpoints().filter(ep => !curr_eps.find(_ep => _ep.endpoint_id() === ep.id)).map(ep => {
            return {
                id: ep.id
            };
        });
    });

    self.allowed_selected = ko.observable();

    self.disallowed_availables = ko.computed(() => {
        const curr_eps = self.endpoints().filter(e => !e.white_listed());
        return parent.known_endpoints().filter(ep => !curr_eps.find(_ep => _ep.endpoint_id() === ep.id) && ep.id != parent.current_endpoint.id).map(ep => {
            return {
                id: ep.id
            };
        });
    });

    self.disallowed_selected = ko.observable();

    self.allowed_role_availables = ko.computed(() => {
        return parent.roles().filter(r => !self.roles().find(_r => _r.role_id === r.id));
    });

    self.allowed_role_selected = ko.observable();

    self.submit_ep = (ep_id, allowed) => {
        return fetch('/admin/add-endpoint-rule', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                policy_id: self.id,
                endpoint_id: ep_id,
                white_listed: allowed,
                disabled: false
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                if (ret.id) {
                    const ep = new endpoint_link(self, undefined, ep_id === parent.current_endpoint.id);
                    ep.id = ret.id;
                    ep.white_listed(allowed);
                    ep.endpoint_id(ep_id);
                    self.endpoints.push(ep);
                }
            } else {
                alert(ret.error);
            }
        });
    };

    self.add_allowed_ep = () => {
        self.adding_allowed_ep(true);
    };

    self.submit_allowed_ep = () => {
        if (!self.allowed_selected())
            return;
        self.submit_ep(self.allowed_selected().id, true).then(() => {
            self.allowed_selected(undefined);
            self.adding_allowed_ep(false);
        });
    };

    self.cancel_allowed_ep = () => {
        self.allowed_selected(undefined);
        self.adding_allowed_ep(false);
    };

    self.add_disallowed_ep = () => {
        self.adding_disallowed_ep(true);
    };

    self.submit_disallowed_ep = () => {
        if (!self.disallowed_selected())
            return;
        self.submit_ep(self.disallowed_selected().id, false).then(() => {
            self.disallowed_selected(undefined);
            self.adding_disallowed_ep(false);
        });
    };

    self.cancel_disallowed_ep = () => {
        self.disallowed_selected(undefined);
        self.adding_disallowed_ep(false);
    };

    self.remove_ep = ep => {
        if (ep.id) {
            fetch('/admin/remove-endpoint-rule', {
                method: 'post',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json, text/plain',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    policy_id: self.id,
                    endpoint_id: ep.endpoint_id(),
                    white_listed: ep.white_listed()
                })
            }).then(res => res.json()).then(ret => {
                if (ret.ok) {
                    self.endpoints.remove(_ep => _ep.endpoint_id() === ep.endpoint_id() && _ep.white_listed() === ep.white_listed());
                } else {
                    alert(ret.error);
                }
            });
        } else {
            self.endpoints.remove(_ep => _ep.endpoint_id() === ep.endpoint_id() && _ep.white_listed() === ep.white_listed());
        }
    };

    self.add_allowed_role = () => {
        self.adding_allowed_role(true);
    };

    self.submit_allowed_role = () => {
        if (!self.allowed_role_selected())
            return;
        const role_id = self.allowed_role_selected().role_id;
        fetch('/admin/add-role-rule', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                policy_id: self.id,
                role_id: role_id,
                disabled: false
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                if (ret.id) {
                    const rl = new role_link(self, undefined);
                    rl.id = ret.id;
                    rl.role_id = role_id;
                    self.roles.push(rl);
                }
            } else {
                alert(ret.error);
            }
            self.allowed_role_selected(undefined);
            self.adding_allowed_role(false);
        });
    };

    self.cancel_allowed_role = () => {
        self.allowed_role_selected(undefined);
        self.adding_allowed_role(false);
    };

    self.remove_role = role => {
        if (role.id) {
            fetch('/admin/remove-role-rule', {
                method: 'post',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json, text/plain',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    policy_id: self.id,
                    role_id: role.role_id
                })
            }).then(res => res.json()).then(ret => {
                if (ret.ok) {
                    self.roles.remove(_r => _r.role_id === role.endpoint_id());
                } else {
                    alert(ret.error);
                }
            });
        } else {
            self.roles.remove(_r => _r.role_id === role.endpoint_id());
        }
    };

};

const ur_link = function (p, data) {
    const self = this;
    const parent = p;

    self.id = data ? data.id : undefined;
    self.user_id = data ? data.user_id : undefined;
    self.role_id = data ? data.role_id : undefined;
    self.disabled = ko.observable(data ? !!data.disabled : false);
    self.rolename = data ? data.rolename : undefined;

    self.disabled.subscribe(bval => {
        fetch('/admin/set-user-role-disable', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: self.user_id,
                role_id: self.role_id,
                disabled: bval
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                parent.parent.roles().filter(r => r.id === self.role_id).forEach(r => {
                    r.users().filter(ul => ul.user_id === self.user_id).forEach(ul => {
                        ul.disabled(bval);
                    });
                });
            } else {
                alert(ret.error);
            }
        });
    });

    self.remove = () => {
        parent.remove_role(self.role_id);
    };
};

const ru_link = function (p, data) {
    const self = this;
    const parent = p;

    self.id = data ? data.id : undefined;
    self.user_id = data ? data.user_id : undefined;
    self.role_id = data ? data.role_id : undefined;
    self.username = data ? data.username : undefined;
    self.disabled = ko.observable(data ? !!data.disabled : false);

    self.disabled.subscribe(bval => {
        fetch('/admin/set-user-role-disable', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: self.user_id,
                role_id: self.role_id,
                disabled: bval
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                parent.parent.users().filter(u => u.id === self.user_id).forEach(u => {
                    u.roles().filter(rl => rl.role_id === self.role_id).forEach(rl => {
                        rl.disabled(bval);
                    });
                });
            } else {
                alert(ret.error);
            }
        });
    });
    self.remove = () => {
        parent.remove_user(self.user_id);
    };
};

const role = function (p, data) {
    const self = this;
    self.parent = p;
    self.id = data.id;
    self.name = data.name;
    self.users = ko.observableArray();
    if (data.users) {
        data.users.forEach(u => {
            self.users.push(new ru_link(self, u));
        });
    }
    self.is_current = ko.observable(false);
    self.adding_user = ko.observable(false);
    self.users_available = ko.computed(() => {
        return self.parent.users().filter(u => !self.users().find(ul => ul.user_id === u.id));
    });
    self.user_selected = ko.observable();

    self.add_new_user = (id, user_id) => {
        const ul = new ru_link(self);
        ul.id = id;
        ul.user_id = user_id;
        ul.role_id = self.id;
        ul.username = self.parent.users().find(u => u.id === user_id).username;
        ul.disabled(false);
        self.users.push(ul);
    };

    self.select = () => {
        self.parent.curr_role(self);
        self.parent.roles().forEach(r => {
            r.is_current(false);
        });
        self.is_current(true);
    };

    self.add_user = () => {
        self.adding_user(true);
    };

    self.submit_user = () => {
        if (!self.user_selected())
            return;
        fetch('/admin/add-user-role', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: self.user_selected().id,
                role_id: self.id,
                disabled: false
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                self.parent.users().filter(u => u.id === self.user_selected().id).forEach(u => {
                    u.add_new_role(ret.id, self.id);
                });
                self.add_new_user(ret.id, self.user_selected().id);
            } else {
                alert(ret.error);
            }
            self.user_selected(undefined);
            self.adding_user(false);
        });
    };

    self.cancel_user = () => {
        self.user_selected(undefined);
        self.adding_user(false);
    };

    self.remove_user = user_id => {
        fetch('/admin/remove-user-role', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user_id,
                role_id: self.id
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                self.parent.users().filter(u => u.id === user_id).forEach(u => {
                    u.roles.remove(rl => rl.role_id === self.id);
                });
                self.users.remove(ul => ul.user_id === user_id);
            } else {
                alert(ret.error);
            }
        });
    };
};

const user = function (p, data) {
    const self = this;
    self.parent = p;
    self.id = data.id;
    self.short_id = data.id.substr(0, 4) + '...';
    self.username = data.username;
    self.authenticated = ko.observable(!!data.authenticated);
    self.details = ko.observable(data.details);
    self.roles = ko.observableArray();
    if (data.roles) {
        data.roles.forEach(r => {
            self.roles.push(new ur_link(self, r));
        });
    }
    self.is_current = ko.observable(false);
    self.adding_role = ko.observable(false);
    self.roles_available = ko.computed(() => {
        return self.parent.roles().filter(r => !self.roles().find(rl => rl.role_id === r.id));
    });
    self.role_selected = ko.observable();

    self.add_new_role = (id, role_id) => {
        const rl = new ur_link(self);
        rl.id = id;
        rl.user_id = self.id;
        rl.role_id = role_id;
        rl.rolename = self.parent.roles().find(r => r.id === role_id).name;
        rl.disabled(false);
        self.roles.push(rl);
    };

    self.select = () => {
        self.parent.curr_user(self);
        self.parent.users().forEach(u => {
            u.is_current(false);
        });
        self.is_current(true);
    };

    self.add_role = () => {
        self.adding_role(true);
    };

    self.submit_role = () => {
        if (!self.role_selected())
            return;
        fetch('/admin/add-user-role', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: self.id,
                role_id: self.role_selected().id,
                disabled: false
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                self.parent.roles().filter(r => r.id === self.role_selected().id).forEach(r => {
                    r.add_new_user(ret.id, self.id);
                });
                self.add_new_role(ret.id, self.role_selected().id);
            } else {
                alert(ret.error);
            }
            self.role_selected(undefined);
            self.adding_role(false);
        });
    };

    self.cancel_role = () => {
        self.role_selected(undefined);
        self.adding_role(false);
    };

    self.remove_role = role_id => {
        fetch('/admin/remove-user-role', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: self.id,
                role_id: role_id
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                self.parent.roles().filter(r => r.id === role_id).forEach(r => {
                    r.users.remove(ul => ul.user_id === self.id);
                });
                self.roles.remove(rl => rl.role_id === role_id);
            } else {
                alert(ret.error);
            }
        });
    };
};

const model = function () {
    const self = this;

    let original_label = '';
    self.node_label = ko.observable('');
    self.current_endpoint;
    self.policies = ko.observableArray();
    self.curr_policy = ko.observable();
    self.users = ko.observableArray();
    self.curr_user = ko.observable();
    self.roles = ko.observableArray();
    self.curr_role = ko.observable();
    self.known_endpoints = ko.observableArray();
    self.is_label_changed = ko.pureComputed(() => {
        return self.node_label() != original_label;
    });

    self.update_label = () => {
        if (original_label === self.node_label())
            return;
        fetch('/admin/update-node-label', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                node_label: self.node_label()
            })
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                original_label = self.node_label();
                self.node_label('');
                self.node_label(original_label)
            } else {
                alert(ret.error);
            }
        });
    };

    self.load_data = () => {
        return fetch('/admin/load-data', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: '{}'
        }).then(res => res.json()).then(ret => {
            if (ret.ok) {
                original_label = ret.node_label;
                self.node_label(ret.node_label);
                if (ret.endpoints) {
                    self.current_endpoint = ret.endpoints.find(ep => ep.id === ret.current_epid);
                    self.known_endpoints(ret.endpoints);
                }
                ret.policies.forEach(p => {
                    self.policies.push(new policy(self, p));
                });
                if (ret.policies.length > 0)
                    self.curr_policy(self.policies()[0]);
                ret.users.forEach(u => {
                    self.users.push(new user(self, u));
                });
                /*
                if (ret.users.length > 0)
                    self.curr_user(self.users()[0]);
                */
                ret.roles.forEach(r => {
                    self.roles.push(new role(self, r));
                });
                /*
                if (ret.roles.length > 0)
                    self.curr_role(self.roles()[0]);
                */
            } else {
                alert(ret.error)
            }
        });
    };

    self.stop = mode => {
        const burl = mode === 'web' ? '/gateway' : '/gateway/console';
        fetch(burl + '/stop', {
            method: 'post',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        }).then(res => res.json()).then(ret => {
            window.location = '/';
        });
    };
};

export default model;