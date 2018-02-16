import model from '../models/stream-cast-model.js';

const socket_io_opts = {
    'reconnection': true,
    'reconnectionDelay': 1000,
    'reconnectionDelayMax': 5000,
    'reconnectionAttempts': 5
};

const common_handlers = ws => {

};

$(() => {
    const ws = io(socket_io_opts);
    common_handlers(ws);
    const m = new model(ws);
    ko.applyBindings(m);
    m.init();
});