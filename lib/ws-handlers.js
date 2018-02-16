'use strict';

const handlers = io => {
    global.__io = io;
    //io.on('...', )
};

module.exports = handlers;