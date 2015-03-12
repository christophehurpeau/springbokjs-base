/* jshint maxlen: 200 */

process.on('uncaughtException', function(err) {
    console.error('uncaughtException:', err && (err.stack || err.message || err));
});

require('es6-shim/es6-shim');

var S = require('springbokjs-utils');
var fs = require('springbokjs-utils/fs');
var tinylr = require('tiny-lr');
var rimraf = require('rimraf');

var plugins = require('gulp-load-plugins')({
    config: __dirname + '/package.json'
});
var gutil = require('gulp-util');
// var recess = require('gulp-recess');
// var rename = require('gulp-rename');
var notifier = require('node-notifier');

// var INotifyWait = require('inotifywait');

var argv = require('minimist')(process.argv.slice(2), {
    alias: {
        production: 'prod'
    }
});

var startport, startlivereloadPort;

var init = function(gulp, options) {
    init = function() {};
    gulp.task('define-port', function(done) {
        if (startport || argv['socket-folder']) {
            return done();
        }
        var portscanner = require('portscanner');
        startport = argv.startport || 3000;
        portscanner.findAPortNotInUse(startport, startport + 50, '127.0.0.1', function(error, port) {
            startport = port;
            done();
        });
    });
    gulp.task('define-livereload-port', function(done) {
        if (startlivereloadPort) {
            return done();
        }
        var portscanner = require('portscanner');
        startlivereloadPort = argv.startlivereloadPort || 3100;
        portscanner.findAPortNotInUse(startlivereloadPort, startlivereloadPort + 50, '127.0.0.1', function(err, port) {
            startlivereloadPort = port;
            done();
        });
    });
};


var spawnGulp = !argv.spawnedProcess && function(gulp) {
    return function() {
        var spawn = require('child_process').spawn;
        var childProcess, closed = true;

        var args = process.argv.slice(1);
        args.push('--spawnedProcess');
        var spawnChildren = function(e) {
            console.log('spawn child');
            // kill previous spawned process
            if (!closed && childProcess) {
                childProcess.on('close', function(code, signal) {
                    setTimeout(spawnChildren, 1000);
                });
                childProcess.kill();
                return;
            }

            // `spawn` a child `gulp` process linked to the parent `stdio`
            closed = false;
            childProcess = spawn(process.argv[0], args, { stdio: 'inherit' });
            childProcess.on('close', function(code, signal) {
                console.log('child process terminated due to receipt of signal ' + signal);
                closed = true;
            });
        };

        // gulp.watch('gulpfile.js', spawnChildren);
        spawnChildren();
    };
};

module.exports = function(pkg, gulp, options) {
    var _notify = function(title, message) {
        notifier.notify({
            // https://github.com/mikaelbr/node-notifier/blob/master/lib/notifiers/notify-send.js
            message: message === undefined ? title : message,
            title: title || 'Gulp',
            // expire: 2000,
            hint: 'int:transient:1'
        });
    };

    var logAndNotify = function(notifyMessage, doNotLog) {
        return function(err) {
            _notify('Gulp ERROR', notifyMessage || err);
            if (!doNotLog) {
                if (err && !err.fileName && !err.lineNumber && err.message && err.message !== '[object Object]') {
                    console.warn(err.message);
                    console.log(notifyMessage, typeof err.message, err);
                } else if (err.stack) {
                    gutil.log(err.plugin);
                    gutil.log(err.stack);
                } else {
                    gutil.log(err);
                }
            }
        };
    };


    /* OPTIONS */

    if (options.es6to5Options) {
        throw new Error('set options.babelOptions now, es6to5 is deprecated.');
    }
    if (options.es6to5BrowserOptions) {
        throw new Error('set options.babelBrowserOptions now, es6to5 is deprecated.');
    }


    options.babelOptions = options.babelOptions || {};
    options.babelOptions = Object.assign(options.babelOptions, {
        blacklist: options.babelOptions.blacklist || [ 'regenerator' ],
        modules: options.babelOptions.modules || 'common'
    });

    options.babelBrowserOptions = {
    };

    var paths = Object.assign({
        scripts: '**/*.js',
        templatesEJS: '**/*.ejs',
        templatesJSX: '**/*.jsx',
        public: 'public/',
        browser: {},
        server: 'src/server/',
        config: 'src/config/',
        stylesIncludePath: ['bower_components/']
    }, options.paths);
    paths.common = Object.assign({
        src: false,/*{
            browser: 'src/common/browser/',
            common: 'src/common/common/',
            server: 'src/common/server/',
        }*/
        dest: 'lib/common/', // destination for server-side.
    }, paths.common);
    paths.browser = Object.assign({
        src: 'src/browser/',
        dist: 'public/dist/',
        js: 'js/',
        mainscripts: pkg.name + '.js',
        styles: 'style/',
        templates: 'templates/',
        iconfont: 'iconfont/',
        mainstyle: 'main.less',
        images: 'images',
    }, paths.browser);

    if (!Array.isArray(paths.browser.mainscripts)) {
        paths.browser.mainscripts = [ paths.browser.mainscripts ];
    }
    paths.server = paths.server !== false && Object.assign({
        common: 'src/common/',
        dist: 'lib/',
        startfile: 'server.js',
        configdest: 'lib/'
    }, S.isString(paths.server) ? { src: paths.server } : paths.server);

    var prefix = options.prefix = options.prefix || '';
    options.paths = paths;
    options.argv = argv;

    /* Config */
    gulp.task(prefix + 'init-config', function(done) {
        if (!argv.env) {
            return done();
        }
        fs.mkdir(paths.server.configdest)
            .catch(function() {})
            .then(function() {
                return Promise.all([
                    fs.readYamlFile(paths.config + 'common.yml').catch(function() { }),
                    fs.readYamlFile(paths.config + argv.env + '.yml'),
                    fs.readYamlFile(paths.config + 'local.yml').catch(function() { }),
                ]).then(function(results) {
                    var config = {};
                    var includes = results[0] && results[0].includes || [];
                    if (results[1].include) {
                        includes.push.apply(includes, results[1].include);
                    }
                    if (results[2] && results[2].include) {
                        includes.push.apply(includes, results[2].include);
                    }
                    return Promise.all(includes.map(function(file) {
                        return fs.readYamlFile(paths.config + file + '.yml');
                    })).then(function(configs) {
                        configs.push.apply(configs, results);
                        'common browser server'.split(' ').forEach(function(key) {
                            config[key] = config[key] || {};
                            configs.forEach(function(configPart) {
                                if (configPart && configPart[key]) {
                                    Object.assign(config[key], configPart[key]);
                                }
                            });

                        });
                        options.browserConfig = Object.assign({
                            basepath: '/',
                        }, config.common || {}, config.browser || {});
                        options.browserConfig.webpath = options.browserConfig.webpath || options.browserConfig.basepath;

                        options.serverConfig = Object.assign(config.common || {}, config.server || {});
                        return Promise.all([
                            fs.writeFile(paths.server.configdest + 'config.js',
                                    'module.exports = ' + JSON.stringify(options.serverConfig, null, 4) + ';'),
                            fs.writeFile(paths.browser.src + 'config-browser.js',
                                    '// Auto generated file from yaml\n' +
                                    'module.exports = ' + JSON.stringify(options.browserConfig, null, 4) + ';'),
                        ]);
                    });

                });
            })
            .then(function() {
                done();
            })
            .catch(function(err) {
                console.error(err.stack || err.message || err);
                done(err);
            });

    });

    /* Init : tasks only applied once */
    init(gulp, options);

    var tasks = [
        /* public */
        require('./tasks/browser-public.js'),
        /* Styles */
        require('./tasks/browser-styles.js'),
        /* iconfont */
        require('./tasks/browser-iconfont.js'),
        /* Lint Scripts */
        require('./tasks/lint-scripts.js'),
        /* Browser scripts */
        require('./tasks/browser-scripts.js'),
        /* Server scripts */
        require('./tasks/server-scripts.js'),
        /* Browser Templates */
        require('./tasks/browser-templates.js'),
        /* Server Templates */
        require('./tasks/server-templates.js'),
    ];
    var watchTasks = [];

    tasks.forEach(function(task) {
        var result = task(gulp, plugins, options, logAndNotify, pkg);
        if (result) {
            watchTasks.push(result);
        }
    });



    /* Images */

    gulp.task(prefix + 'browser-images', function() {
        return gulp.src(
                paths.browser.src + paths.browser.images + '/**/*',
                { base: paths.browser.src + paths.browser.images }
            )
            .pipe(gulp.dest(paths.public + 'images/'));
    });

    gulp.task(prefix + 'browser-imagesmin', [prefix + 'browser-images'], function() {
        return gulp.src(
                paths.browser.src + paths.browser.images + '/**/*',
                { base: paths.browser.src + paths.browser.images }
            )
            .pipe(plugins.imagemin({ progressive: true }))
            .pipe(gulp.dest(paths.public + 'images/'));
    });


    /* Tasks */

    if (argv['no-lint']) {
        gulp.task(prefix + 'browser-js', [prefix + 'browserifyjs']);
    } else {
        gulp.task(prefix + 'browser-js', [prefix + 'browser-lintjs', prefix + 'browserifyjs']);
    }
    // gulp.task(prefix + 'browser-css', [prefix + 'browser-concatcss']);
    if (paths.server) {
        if (argv['no-lint']) {
            gulp.task(prefix + 'server-js', [prefix + 'server-buildjs']);
        } else {
            gulp.task(prefix + 'server-js', [prefix + 'server-lintjs', prefix + 'server-buildjs']);
        }
    }

    // gulp.task('build', ['cssmin', 'jsmin', 'ejsmin', 'imagesmin']);
    var tasksDefault = [
        prefix + 'browser-public',
        prefix + 'browser-styles',
        prefix + 'browser-iconfont',
        prefix + 'browser-js',
        prefix + 'browser-templates',
        prefix + 'browser-images'
    ];
    if (paths.browser.independantStyles) {
        tasksDefault.push(prefix + 'browser-independant-styles');
    }
    if (argv.env) {
        tasksDefault.unshift(prefix + 'init-config');
    }
    if (paths.server !== false) {
        tasksDefault.push.apply(tasksDefault, [
            prefix + 'server-js',
            prefix + 'server-templates',
        ]);
    }
    gulp.task(prefix + 'default', tasksDefault);

    gulp.task(prefix + 'lint', [prefix + 'lintjs']);

    gulp.task(prefix + 'clean', function(done) {
        Promise.all([
            paths.server && paths.server.dist,
            paths.common && paths.common.dist,
            paths.server && paths.server.configdest && paths.server.configdest + 'config.js',
            paths.browser.dist,
        ].map(function(path) {
            if (path) {
                console.log('Removing ' + path);
                return new Promise(function(resolve, reject) {
                    rimraf(path, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(err);
                        }
                    });
                });
            }
        })).then(function() { done(); }).catch(done);
    });


    /* Watcher */


    if (spawnGulp) {
        gulp.task(prefix + 'watch', spawnGulp(gulp));
    } else {
        gulp.task(
            prefix + 'watch',
            ['define-port', 'define-livereload-port', prefix + 'init-config', prefix + 'default'],
            function() {
                var logfileChanged = function(from) {
                    return function(file) {
                        console.log('[watch] ' + from + ': ' + file.path);
                    };
                };

                var port = startport + (options.multiIndex || 0);
                var livereloadPort = startlivereloadPort + (options.multiIndex || 0);
                console.log('create livereload server on port ' + livereloadPort);
                var livereloadServer = tinylr({ port: livereloadPort });
                var changed = function(filePath) {
                    if (filePath.substr(-4) === '.map') {
                        // ignore reload for source map files
                        return;
                    }
                    console.log('[livereload] ' + filePath);
                    livereloadServer.changed({ params: { files: [ filePath ] } });
                };

                var daemon;
                if (paths.server) {
                    var socketFolder = argv['socket-folder'] && argv['socket-folder'].replace(/\/+$/, '') + '/';
                    var socketName = prefix && prefix.replace(/[\-_]+$/, '') || 'socket';
                    daemon = require('springbokjs-daemon').node([
                        '--harmony', paths.server.dist + paths.server.startfile,
                        '--livereloadPort=' + livereloadPort,
                        socketFolder ? '--socket-path=' + socketFolder + socketName + '.sock' : '--port=' + port,
                    ]);

                    process.on('exit', function(code) {
                        daemon.stop();
                        livereloadServer.close();
                    });
                }

                watchTasks.forEach(function(task) {
                    task(logfileChanged);
                });




                gulp.watch(paths.browser.src + paths.browser.images, [prefix + 'browser-images'])
                    .on('change', logfileChanged('images'));


                livereloadServer.listen(livereloadPort, function() {
                    if (paths.server) {
                        daemon.start();

                        gulp.watch(paths.config + '*.yml', [prefix + 'init-config']);

                        var restart = function(done) {
                            console.log('restart asked');
                            daemon.restart();
                            daemon.once('stdout', function(data) {
                                var string = data.toString().toLowerCase();
                                if (string.indexOf('listening') !== -1) {
                                    if (done) {
                                        done();
                                    }
                                    _notify((prefix ? prefix + ': ' : '') + 'Server restarted');
                                }
                            });
                        };

                        gulp.watch([
                            paths.server.dist + '**/*',
                            paths.common.dest + '**/*' ,
                            paths.server.configdest + 'config.js',
                        ]).on('change', function(file) {
                            logfileChanged('server')(file);
                            restart(function() {
                                changed(file.path);
                            });
                        });

/*
                        var nodeModulesDirectory = process.cwd() + '/node_modules';
                        var _timeoutRestart;
                        var timeoutRestart = function() {
                            if (_timeoutRestart) {
                                clearTimeout(_timeoutRestart);
                            }
                            _timeoutRestart = setTimeout(restart, 600);
                        };
                        var addWatcher = function(directory) {
                            directory = fs.realpathSync(directory);
                            console.log('add watcher ' + directory);
                            var watcher = new INotifyWait(directory, { recursive: true });
                            watcher.on('error', console.error);
                            watcher.on('add', function(filename) {
                                console.log(filename + ' added');
                                timeoutRestart();
                            });
                            watcher.on('change', function(filename) {
                                console.log(filename + ' changed');
                                timeoutRestart();
                            });
                        };

                        var watchNodeModules = new INotifyWait(nodeModulesDirectory, { recursive: false });
                        watchNodeModules.on('error', console.error);
                        watchNodeModules.on('add', function(filename, stats) {
                            console.log(filename + ' added');
                            if (stats.isDir) {
                                addWatcher(filename);
                            }
                        });

                        var nodeModulesDirectories = fs.readdirSync(nodeModulesDirectory);
                        nodeModulesDirectories.forEach(function(nodeModuleDirectory) {
                            addWatcher(nodeModulesDirectory + '/' + nodeModuleDirectory + '/');
                        });
*/
                    } else {
                        var express = require('express');
                        var app = express();
                        app.use(express.static(paths.public));
                        app.use('/src', express.static('src/'));
                        app.listen(port, gutil.log.bind(null, 'static server started, listening on port ' +
                                                                gutil.colors.magenta(port)));
                    }
                });

                gulp.watch(['data/**/*', paths.browser.dist + '**/*'])
                    .on('change', function(file) {
                        logfileChanged('data&dist')(file);
                        changed(file.path);
                    });
            }
        );
    }
};

module.exports.multi = function(pkg, gulp, multi) {
    var prefixes = Object.keys(multi);
    prefixes.forEach(function(prefix, index) {
        var options = multi[prefix];
        options.prefix = prefix + '-';
        options.multiIndex = index;
        module.exports(pkg, gulp, options);
    });
    'default watch clean lint'.split(' ').forEach(function(task) {
        var tasks = prefixes.map(function(prefix) {
            return prefix + '-' + task;
        });
        if (task === 'watch') {
            if (spawnGulp) {
                tasks = spawnGulp(gulp);
            } else {
                tasks.unshift('define-livereload-port');
                tasks.unshift('define-port');
            }
        }
        gulp.task(task, tasks);
    });
};
