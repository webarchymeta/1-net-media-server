'use strict';

const
    path = require('path'),
    net = require('net'),
    express = require('express'),
    favicon = require('serve-favicon'),
    ejs = require('ejs'),
    socket_io = require('socket.io'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    session = require('cookie-session'),
    winston = require('winston'),
    config = require(__dirname + '/config/config'),
    i18n = require(__dirname + '/lib/i18n-api'),
    sqlite = require(__dirname + '/lib/sqlite-api'),
    userStore = require(__dirname + '/lib/user-store'),
    oauth = require(__dirname + '/lib/1-net-oauth2'),
    errorCatcher = require(__dirname + '/lib/error-catchers'),
    ws_handlers = require(__dirname + '/lib/ws-handlers'),
    logHandler = require(__dirname + '/lib/log-handler'),
    feed_target = require(__dirname + '/lib/feed-processor');

global.config = config;

const
    dns_service = require(__dirname + '/lib/dns-service'),
    root = process.cwd(),
    app = express();

let server, logdir;
if (config.web.tls && config.web.tls.enabled) {
    const fs = require('fs');
    server = require('https').createServer({
        key: fs.readFileSync(config.web.tls.key),
        cert: fs.readFileSync(config.web.tls.cert)
    }, app);
} else {
    server = require('http').createServer(app);
}

winston.level = config.log && config.log.winston && config.log.winston.level ? config.log.winston.level : 'info';
if (config.log && config.log.winston.file && config.log.winston.file.enabled) {
    winston.add(winston.transports.File, {
        filename: (logdir ? logdir : '') + 'logs/server.log',
        level: config.log.winston.file.level || 'info'
    });
}

const routes = require(__dirname + '/routes/index');

i18n.configure({
    defaultLocale: config.defaultLocale,
    locales: config.supportedLocals,
    cookie: 'locale',
    updateFiles: false,
    directory: path.join(root, 'locales')
});

app.use(i18n.normalize);
app.use(i18n.init);
app.set('views', path.join(root, 'views'));
app.engine('.html', ejs.__express);
app.set('view options', {
    layout: false
});
app.set('view engine', 'ejs');
app.use(session({
    keys: config.cookieSessionKeys
}));
//app.use(favicon(root + '/public/images/site-icon.ico'));
logHandler(config)(app);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use('/libs/', express.static(path.join(root, 'public/bower_components')));
app.use(express.static(path.join(root, 'public')));
app.use('/', routes);
errorCatcher(app);

const feed_server = net.createServer(feed_target);

feed_server.on('error', err => {
    winston.log('error', 'feed server error:');
    console.log(err);
});

feed_server.listen(config.tcp, () => {
    global.feed_server = {
        host: config.tcp.host,
        port: config.tcp.port
    };
    winston.log('info', 'feed server listening on port ' + config.tcp.port + ' at ' + (config.tcp.host ? config.tcp.host : '*'));
});

server.on("listening", () => {
    global.web_server = {
        host: config.web.host,
        port: config.web.port
    };
    winston.log('info', 'web server listening on port ' + config.web.port + ' at ' + (config.web.host ? config.web.host : '*'));
});

server.listen(config.web.port, config.web.host, undefined);

ws_handlers(socket_io(server));

const dns = new dns_service.service();
dns.init();