module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-bower-task');
    grunt.loadNpmTasks('grunt-bower-concat');
    grunt.loadNpmTasks('grunt-wiredep');
    grunt.loadNpmTasks('grunt-nodemon');
    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-shell');

    grunt.registerTask('reboot', function() {
        require('fs').writeFileSync('.rebooted', 'rebooted');
    });
    grunt.registerTask('default', ['replace:dev', 'browserify','bower', 'wiredep', 'concurrent']);
    grunt.registerTask('dist', ['jshint', 'browserify', 'bower', 'bower_concat', 'copy:dist', 'uglify', 'replace:dist']);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concurrent: {
            dev: {
                tasks: ['jshint', 'nodemon', 'watch'],
                options: {
                    logConcurrentOutput: true
                }
            },
        },
        shell: {
            replacePort: {
          //      command: "sed -i -e 's/port = 8000/port = 80/g' dist/server/server.js"
            }
        },
        watch: {
            options: {
                livereload: true,
            },
            server: {
                files: ['.rebooted'],
            }, 
            js: {
                files: ['server/*.js', 'client/*.js', 'share/*.js'],
                tasks: ['jshint', 'browserify'],
            },
            html: {
                files: ['html/*'],
                tasks: ['replace:dev', 'wiredep'],
            },
            reload: {
                files: ['*.html'],
            }
        }, 
        nodemon: {
            dev: {
                script: 'server.js',
                options: {
                    watch: ['*.js', '../share/*.js'],
                    cwd: 'server/',
                    callback: function (nodemon) { 
                        nodemon.on('config:update', function () {
                            setTimeout(function() { 
                             //   require('open')('http://localhost:8000');
                            }, 1000);
                        });

                        nodemon.on('restart', function () {
                            setTimeout(function() {
                                require('fs').writeFileSync('.rebooted', 'rebooted');
                            }, 1000);
                        });
                    }
                }
            }
        },
        copy: {
            dist: {
                files: [
                    {expand: true, src: ['server/**'], dest: 'dist/'},
                    {expand: true, src: ['package.json'], dest: 'dist/'},
                    {expand: true, src: ['share/**'], dest: 'dist/'},
                    {expand: true, src: ['assets/**'], dest: 'dist/'},
                ],
            },
        },
        replace: {
            dist: {
                options: {
                    patterns: [
                        {
                            match: 'dist',
                            replacement: '<script src="libs.min.js"></script>\n<script src="game.min.js" defer></script>'
                        },
                        {
                            match: 'dev',
                            replacement: ''
                        },
                        {
                            match: 'livereload',
                            replacement: ''
                        },
                    ]
                },
                files: [
                    {expand: true, flatten: true, src: ['html/index.html'], dest: 'dist/'}
                ]
            },
            dev: {
                options: {
                    patterns: [
                        {
                            match: 'livereload',
                            replacement: '<script src="http://localhost:35729/livereload.js?snipver=1" type="text/javascript"></script>'
                        },
                        {
                            match: 'dist',
                            replacement: ''
                        },
                        {
                            match: 'dev',
                            replacement: '<script src="tmp/game.js" defer></script>'
                        }
                    ]
                },
                files: [
                    {expand: true, flatten: true, src: ['html/index.html'], dest: './'}
                ]

            }
        },
        wiredep: {
            dev: {
                src: [
                    'index.html',  
                ],
            }
        },
        bower_concat:{
            all: {
                dest: 'tmp/libs.js'
            }
        },
        bower: {
            install: {
            }
        },
        uglify: {
            options: {
                //exportAll: true,
                compress: {
                    drop_console: true
                },
                //mangleProperties: true,
                mangle: {
                },
                //reserveDOMCache: true,
                //mangleProperties: ,
                //reserveDOMCache: true,
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                    '<%= grunt.template.today("yyyy-mm-dd") %> */'
            },
            bower: {
                files: {
                    'dist/libs.min.js': ['tmp/libs.js']
                }
            },
            game: {
                files: {
                    'dist/game.min.js': ['tmp/game.js']
                }
            },
            share: {
                files: {
                    'dist/share/player.js': ['dist/share/player.js'],
                    'dist/share/common.js': ['dist/share/common.js'],
                    'dist/share/missiles.js': ['dist/share/missiles.js']
                }
            }
        },
        jshint: {
            options: {
                esversion: 6,
            },
            all: ['Gruntfile.js', 'client/*.js','server/*.js', 'share/*.js']
        },
        browserify: {
            main: {
                src: ['client/hud.js', 'client/draw.js', 'client/client.js', 'share/*.js'],
                dest: 'tmp/game.js'
            }
        },
    });
};
