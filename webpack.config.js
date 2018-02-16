const
    path = require('path'),
    nodeExternals = require('webpack-node-externals'),
    UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    target: 'node',
    context: __dirname,
    entry: {
        app: './app.js'
    },
    output: {
        path: __dirname,
        filename: 'standalone-[name].js',
        libraryTarget: "commonjs"
    },
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: ['es2015']
                }
            }
        }]
    },
    plugins: [
        new UglifyJSPlugin()
    ],
    externals: [
        nodeExternals(),
        function (context, request, callback) {
            if (/\/schema\/.+\.sql/.test(request))
                return callback(null, request);
            callback();
        },
        function (context, request, callback) {
            if (/\/config$/.test(request)) {
                request = path.normalize(request);
                let config_path = './' + path.relative(process.cwd(), request).replace(/\\/g, '/');
                return callback(null, 'commonjs ' + config_path);
            }
            callback();
        },
        function (context, request, callback) {
            // Every module prefixed with "global-" becomes external
            // "global-abc" -> abc
            if (/\/(\.\.\/)+services/.test(request))
                return callback(null, "commonjs " + request);
            callback();
        }
    ]
};