var path = require("path");

module.exports = {
    context: __dirname,
    entry: {
        "stream-cast": './scripts/bootstraps/stream-cast-entry.js'
    },
    output: {
        path: path.join(__dirname, 'scripts'),
        filename: '[name].js',
        chunkFilename: '[id].chunk.js',
        publicPath: '/scripts/'
    },
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: ['env']
                }
            }
        }]
    },
    plugins: []
};