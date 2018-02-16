const api = function (name, stores) {
    const self = this;
    const idb = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    const dbname = name;
    if (idb) {
        let db = undefined;
        let dic = undefined;
        if (stores) {
            self.stores = stores;
        } else {
            self.stores = ['dictionary'];
        }

        self.deleteDatabase = () => {
            idb.deleteDatabase(dbname);
        };

        self.open = version => {
            version = version || 1;
            return new Promise((resolve, reject) => {
                const request = idb.open(dbname, version);
                request.onupgradeneeded = e => {
                    const _db = e.target.result;
                    // A versionchange transaction is started automatically.
                    e.target.transaction.onerror = err => {
                        reject(err.value);
                    };
                    self.stores.forEach(store => {
                        if (_db.objectStoreNames.contains(store)) {
                            _db.deleteObjectStore(store);
                        }
                        _db.createObjectStore(store, {
                            keyPath: "key"
                        });
                    });
                };
                request.onsuccess = e => {
                    db = e.target.result;
                    resolve(db);
                };
                request.onerror = err => {
                    reject(err.value);
                };
            });
        };

        self.get = (key, store) => {
            store = store || self.stores[0];
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('db not opened');
                } else {
                    const req = db.transaction([store]).objectStore(store).get(key);
                    req.onsuccess = e => {
                        resolve(e.target.result ? e.target.result.value : undefined);
                    };
                    req.onerror = err => {
                        reject(err.value);
                    };
                }
            });
        };

        self.put = (key, value, store) => {
            store = store || self.stores[0];
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('db not opened');
                } else {
                    const req = db.transaction([store], 'readwrite').objectStore(store).put({
                        key: key,
                        value: value
                    });
                    req.onsuccess = e => {
                        resolve();
                    };
                    req.onerror = err => {
                        reject(err.value);
                    };
                }
            });
        };

        self.delete = (key, store) => {
            store = store || self.stores[0];
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('db not opened');
                } else {
                    const req = db.transaction([store], 'readwrite').objectStore('dictionary').delete(key);
                    req.onsuccess = e => {
                        resolve();
                    };
                    req.onerror = err => {
                        reject(err.value);
                    };
                }
            });
        };

        self.getAll = store => {
            store = store || self.stores[0];
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('db not opened');
                } else {
                    const vals = [];
                    const req = db.transaction([store], 'readonly').objectStore(store).openCursor();
                    req.onsuccess = e => {
                        var result = e.target.result;
                        if (result) {
                            vals.push(result.value);
                            result.continue();
                        } else {
                            resolve(vals);
                        }
                    };
                    req.onerror = err => {
                        reject(err.value);
                    };
                }
            });
        };
    }
}

export default api;