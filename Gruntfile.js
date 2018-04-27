module.exports = function (grunt) {
    //Initializing the configuration object
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
            '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
            '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
            '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
            ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
        // Task configuration
        concat: {
            options: {
                separator: ';',
            },
            start: {
                src: [
                    './public/bower_components/font-awesome/css/font-awesome.css',
                    './public/styles/less/site.css'
                ],
                dest: './public/styles/css/site.css',
            }
        },
        less: {
            develop: {
                options: {
                    compress: false, //minifying the result
                },
                files: {
                    './public/styles/less/site.css': './public/styles/less/site.less'
                }
            },
            deploy: {
                options: {
                    compress: true
                },
                files: {
                    './public/styles/less/site.css': './public/styles/less/site.less'
                }
            }
        },
        cssmin: {
            options: {
                shorthandCompacting: false,
                roundingPrecision: -1,
                keepSpecialComments: 0
            },
            target: {
                files: {
                    './public/styles/css/site.css': [
                        './public/bower_components/font-awesome/css/font-awesome.css',
                        './public/styles/less/site.css'
                    ]
                }
            }
        },
        uglify: {
            options: {
                mangle: false // Use if you want the names of your functions and variables unchanged
            },
            t: {
                files: {
                    './public/public/scripts/q.js': ['./node_modules/q/q.js'],
                    './public/public/scripts/modernizr.js': ['./public/bower_components/modernizr/modernizr.js']
                }
            }
        },
        sync: {
            fonts_a: {
                files: [{
                    cwd: './public/bower_components/font-awesome/fonts/',
                    src: ['**'],
                    dest: './public/styles/fonts/'
                }],
                //pretend: true,
                verbose: true
            },
            fonts_b: {
                files: [{
                    cwd: './public/bower_components/bootstrap/fonts/',
                    src: ['**'],
                    dest: './public/styles/fonts/'
                }],
                //pretend: true,
                verbose: true
            }
        },
        shell: {
            packClient: {
                command: [
                    'cd public',
                    'webpack -d --progress',
                    'cd ..'
                ].join('&&')
            },
            packClientProd: {
                command: [
                    'cd public',
                    'webpack -p --progress',
                    'cd ..'
                ].join('&&')
            }
        },
        watch: {
            less: {
                files: ['./public/styles/less/*.less'], //watched files
                tasks: ['build-css'], //tasks to run
                options: {
                    livereload: true //reloads the browser
                }
            },
        }
    });

    // Plugin loading
    grunt.loadNpmTasks('grunt-sync');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-shell');

    // Task definition
    //grunt.registerTask('combine-all-js', ['requirejs:main']);
    grunt.registerTask('build-css', ['less:develop', 'concat:start']);
    grunt.registerTask('build-mini-css', ['less:deploy', 'cssmin:target']);
    grunt.registerTask('sync-fonts', ['sync:fonts_a', 'sync:fonts_b']);
    grunt.registerTask('initial-build', ['build-css', 'sync-fonts', 'uglify']);

    grunt.registerTask('default', ['watch']);
};