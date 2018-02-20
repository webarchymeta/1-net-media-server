'use strict';

const
    path = require('path'),
    fs = require('fs'),
    _ = require('lodash'),
    B = require('bluebird'),
    winston = require('winston'),
    sqlite = require('sqlite3'),
    config = require(__dirname + '/../config/config');

const
    root = process.cwd(),
    relpath = 'data',
    dbfolder = path.join(root, relpath);

const sqliteApi = function () {
    const self = this;
    let db = undefined;

    self.isOpen = false;

    const createDb = db => {
        return new B((resolve, reject) => {
            fs.readFile(path.join(root, '/schema/main-db.sql'), 'utf8', (err, sql) => {
                if (err)
                    return reject(err);
                const sqls = sql.split(';').map(cmd => cmd.trim()).filter(cmd => !!cmd);
                const exec = (i) => {
                    let cmd = sqls[i];
                    db.run(cmd, err => {
                        if (err) {
                            reject(err);
                        } else {
                            if (i < sqls.length - 1) {
                                exec(i + 1);
                            } else {
                                self.isOpen = true;
                                resolve(db);
                            }
                        }
                    });
                };
                exec(0)
            });
        });
    };

    const schemaPatches = (s_c_file, db) => {
        return new B((resolve, reject) => {
            fs.readFile(s_c_file, 'utf8', (err, sql) => {
                if (err)
                    return reject(err);
                const sqls = sql.split(';').map(cmd => cmd.trim()).filter(cmd => !!cmd);
                const exec = (i) => {
                    winston.log('info', ' applying ==> ' + sqls[i]);
                    db.run(sqls[i], err => {
                        if (err) {
                            winston.log('info', ' failed ==> ' + sqls[i]);
                            winston.log('info', err.message || typeof err === 'string' ? err : JSON.stringify(err));
                            reject(err);
                        } else {
                            if (i < sqls.length - 1) {
                                exec(i + 1);
                            } else {
                                process.nextTick(() => {
                                    fs.unlink(s_c_file);
                                });
                                resolve(db);
                            }
                        }
                    });
                };
                exec(0)
            });
        });
    };

    self.open = () => {
        return new B((resolve, reject) => {
            if (self.isOpen) {
                return db;
            }
            const fpath = dbfolder + '/main-db.sqlite';
            const s_c_file = path.join(root, '/schema/schema-patches.sql');
            const has_schema_changes = fs.existsSync(s_c_file);
            const open = isNew => {
                db = new sqlite.Database(fpath, sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE, err => {
                    if (err) {
                        reject(err);
                    } else {
                        if (isNew) {
                            createDb(db).then(() => {
                                self.isOpen = true;
                                resolve(db);
                            }).catch(err => {
                                reject(err);
                            });
                        } else {
                            if (has_schema_changes) {
                                winston.log('info', 'applying schema changes ...');
                                schemaPatches(s_c_file, db).then(() => {
                                    self.isOpen = true;
                                    if (fs.existsSync(fpath + "~")) {
                                        fs.unlink(fpath + "~", () => {
                                            resolve(db);
                                        });
                                    } else {
                                        resolve(db);
                                    }
                                }).catch(err => {
                                    winston.log('error', err.message || typeof err === 'string' ? err : JSON.stringify(err));
                                    self.close().then(() => {
                                        if (fs.existsSync(fpath + "~")) {
                                            fs.unlink(fpath, () => {
                                                const istream = fs.createReadStream(fpath + '~');
                                                const ostream = fs.createWriteStream(fpath);
                                                ostream.on('finish', () => {
                                                    reject(err);
                                                });
                                                istream.on('error', reject);
                                                ostream.on('error', reject);
                                                istream.pipe(ostream);
                                            });
                                        } else {
                                            reject(err);
                                        }
                                    }).catch(_err => {
                                        winston.log('error', _err.message || typeof _err === 'string' ? _err : JSON.stringify(_err));
                                        reject(err);
                                    });
                                });
                            } else {
                                self.isOpen = true;
                                resolve(db);
                            }
                        }
                    }
                });
            };
            if (has_schema_changes) {
                if (fs.existsSync(fpath)) {
                    if (fs.existsSync(fpath + '~')) {
                        fs.unlinkSync(fpath + '~');
                    }
                    const istream = fs.createReadStream(fpath);
                    const ostream = fs.createWriteStream(fpath + '~');
                    ostream.on('finish', () => {
                        open(false);
                    });
                    istream.on('error', reject);
                    ostream.on('error', reject);
                    istream.pipe(ostream);
                } else {
                    open(true);
                }
            } else {
                const isNew = !fs.existsSync(fpath);
                if (isNew) {
                    if (!fs.existsSync(dbfolder)) {
                        let fpath = _.endsWith(root, '/') ? root : root + '/';
                        const dirnodes = relpath.split('/');
                        for (let i = 0; i < dirnodes.length; i++) {
                            if (!dirnodes[i])
                                break;
                            fpath += dirnodes[i] + '/';
                            if (!fs.existsSync(fpath)) {
                                fs.mkdirSync(fpath, 0o700);
                            }
                        }
                        open(true);
                    } else {
                        open(true);
                    }
                } else {
                    open(isNew);
                }
            }
        });
    };

    self.close = () => {
        return new B((resolve, reject) => {
            db.close(err => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    };

    const wrapValue = val => {
        if (typeof val === 'undefined' || val === undefined || val === null || typeof val !== 'string' && typeof val !== 'boolean')
            return val !== null && val !== undefined ? val : 'NULL';
        if (typeof val === 'boolean') {
            return val ? '1' : '0'
        } else if (_.startsWith(val, "'") && _.endsWith(val, "'")) {
            let str = _.trim(val, "'");
            return "'" + str.replace(/'/g, '\'\'') + "'";
        } else if (_.startsWith(val, '"') && _.endsWith(val, '"')) {
            let str = _.trim(val, '"');
            return "'" + str.replace(/'/g, '\'\'') + "'";
        } else {
            return "'" + val.replace(/'/g, '\'\'') + "'";
        }
    };

    const add = item => {
        return new B((resolve, reject) => {
            let sql = 'INSERT INTO "' + item.table + '" (';
            let first = true;
            for (let key in item.rec) {
                if (typeof item.rec[key] != 'undefined') {
                    sql += first ? '' : ', ';
                    sql += '"' + key + '"';
                    first = false;
                }
            }
            sql += ') VALUES (';
            first = true;
            for (let key in item.rec) {
                if (typeof item.rec[key] != 'undefined') {
                    sql += first ? '' : ', ';
                    sql += wrapValue(item.rec[key]);
                    first = false;
                }
            }
            sql += ');';
            db.run(sql, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID); //do not use arrow func in this callback
                }
            });
        });
    };

    const update = item => {
        return new B((resolve, reject) => {
            let pred = '';
            let keys = [];
            if (_.isArray(item.iids)) {
                for (let i = 0; i < item.iids.length; i++) {
                    for (let key in item.iids[i]) {
                        pred += pred ? ' AND ' : '';
                        pred += '"' + key + '"' + (item.iids[i][key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[i][key]));
                        keys.push(key);
                    }
                }
            } else {
                for (let key in item.iids) {
                    pred += pred ? ' AND ' : '';
                    pred += '"' + key + '"' + (item.iids[key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[key]));
                    keys.push(key);
                }
            }
            let sql = 'UPDATE "' + item.table + '" Set ';
            let first = true;
            for (let key in item.rec) {
                if (keys.indexOf(key) === -1) {
                    let val = item.rec[key];
                    if (val !== undefined) {
                        sql += first ? '' : ', ';
                        sql += '"' + key + '" = ' + (val !== '@NULLVAL' && val !== null ? wrapValue(val) : 'NULL');
                        first = false;
                    }
                }
            }
            sql += ' WHERE ' + pred;
            db.run(sql, err => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    };

    self.add_new = item => {
        return add(item);
    };

    self.update_old = item => {
        return update(item);
    };

    self.add_or_update = item => {
        let pred = '';
        if (_.isArray(item.iids)) {
            for (let i = 0; i < item.iids.length; i++) {
                for (let key in item.iids[i]) {
                    pred += pred ? ' AND ' : '';
                    pred += '"' + key + '"' + (item.iids[i][key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[i][key]));
                }
            }
        } else {
            for (let key in item.iids) {
                pred += pred ? ' AND ' : '';
                pred += '"' + key + '"' + (item.iids[key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[key]));
            }
        }
        const query = {
            table: item.table,
            predicate: pred
        };
        return self.find(query).then(rec => {
            if (!rec) {
                return add(item);
            } else {
                return update(item).then(() => rec);
            }
        });
    };

    self.remove = item => {
        return new B((resolve, reject) => {
            let pred = '';
            if (_.isArray(item.iids)) {
                for (let i = 0; i < item.iids.length; i++) {
                    for (let key in item.iids[i]) {
                        pred += pred ? ' AND ' : '';
                        pred += '"' + key + '"' + (item.iids[i][key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[i][key]));
                    }
                }
            } else {
                for (let key in item.iids) {
                    pred += pred ? ' AND ' : '';
                    pred += '"' + key + '"' + (item.iids[key] === null ? ' IS NULL' : '=' + wrapValue(item.iids[key]));
                }
            }
            let sql = 'DELETE FROM "' + item.table + '"';
            sql += ' WHERE ' + pred;
            db.run(sql, function (err) {
                if (err) {
                    reject(err);
                } else {
                    // this value can't be retrieved if the callback is an arrow function, it always return undefined
                    resolve(this.changes);
                }
            });
        });
    };

    self.run = sql => {
        return new B((resolve, reject) => {
            db.run(sql, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    };

    //simple query, one table, no join
    self.find = query => {
        return new B((resolve, reject) => {
            if (!self.isOpen) {
                reject(new Error('database not open'));
            }
            if (typeof query === 'string') {
                db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            } else {
                let sql = 'SELECT ';
                if (!query.props) {
                    sql += '*'
                } else if (typeof query.props === 'object') {
                    let plst = '';
                    if (Array === query.props.constructor) {
                        for (let i = 0; i < query.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += '"' + query.props[i] + '"';
                        }
                    } else {
                        for (let key in query.props) {
                            plst += plst == '' ? '' : ', ';
                            let val = query.props[key];
                            if (typeof val == 'string') {
                                plst += '"' + val + '" AS "' + key + '"';
                            } else {
                                if (val.func) {
                                    plst += val.func + '("' + val.field + '") AS "' + key + '"';
                                }
                            }
                        }
                    }
                    sql += plst;
                } else if (typeof query.props === 'string') {
                    if (query.props.toLowerCase() === 'count') {
                        sql += 'COUNT(*) AS total';
                    }
                }
                if (sql.length > 'select '.length) {
                    sql += ' FROM "' + query.table + '"' + (query.predicate ? ' WHERE ' + query.predicate : '');
                    if (query.group_by) {
                        let plst = '';
                        for (let i = 0; i < query.group_by.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += '"' + query.group_by.props[i] + '"';
                        }
                        sql += ' GROUP BY ' + plst;
                    }
                    sql += ';';
                    db.get(sql, (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    });
                } else {
                    reject(new Error('incomplete sql statement'));
                }
            }
        });
    };

    //simple query, one table, no join
    self.all = query => {
        return new B((resolve, reject) => {
            if (!self.isOpen) {
                reject(new Error('database not open'));
            }
            if (typeof query === 'string') {
                db.all(query, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            } else {
                let sql = 'SELECT ';
                if (!query || !query.props) {
                    if (query && query.rowid)
                        sql += 'rowid,';
                    sql += '*';
                } else if (typeof query.props === 'object') {
                    let plst = '';
                    if (Array === query.props.constructor) {
                        for (let i = 0; i < query.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += query.props[i];
                        }
                    } else {
                        for (let key in query.props) {
                            plst += plst == '' ? '' : ', ';
                            let val = query.props[key];
                            if (typeof val == 'string') {
                                plst += '"' + val + '" AS "' + key + '"';
                            } else {
                                if (val.func) {
                                    plst += val.func + '("' + val.field + '") AS "' + key + '"';
                                }
                            }
                        }
                    }
                    sql += plst;
                } else if (typeof query.props === 'string') {
                    if (query.props.toLowerCase() === 'count') {
                        sql += 'COUNT(*) AS total';
                    }
                }
                if (sql.length > 'select '.length) {
                    sql += ' FROM "' + query.table + '"' + (query.predicate ? ' WHERE ' + query.predicate : '');
                    if (query.group_by) {
                        let plst = '';
                        for (let i = 0; i < query.group_by.props.length; i++) {
                            plst += i == 0 ? '' : ', ';
                            plst += '"' + query.group_by.props[i] + '"';
                        }
                        sql += ' GROUP BY ' + plst;
                    }
                    sql += ';';
                    db.all(sql, (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    });
                } else {
                    reject(new Error('incomplete sql statement'));
                }
            }
        });
    };
};

let dbobj = typeof global.local_db !== 'undefined' ? global.local_db : undefined;

if (!dbobj) {
    dbobj = new sqliteApi();
    global.local_db = dbobj;
}

module.exports = dbobj;