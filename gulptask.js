/* jshint maxlen: 200 */

require('es6-shim/es6-shim');

var S = require('springbokjs-utils');
var objectUtils = require('springbokjs-utils/object');
var fs = require('springbokjs-utils/fs');
var tinylr = require('tiny-lr');
var rimraf = require('rimraf');

var plugins = require('gulp-load-plugins')({
    config: __dirname + '/package.json'
});
var gutil = require('gulp-util');
require('gulp-traceur');
//var recess = require('gulp-recess');
//var rename = require('gulp-rename');
//var es6transpiler = require('gulp-es6-transpiler');
//var notify = require('gulp-notify');
var Notification = require("node-notifier");

var argv = require('minimist')(process.argv.slice(2), {
    alias: {
        'production': 'prod'
    }
});

if (argv.port) {
    console.warn('--port is deprecated, use --startport now');
    argv.startport = argv.port;
}
var startport;

var init = function(gulp, options) {
    var paths = options.paths;
    init = function() {};
    gulp.task('define-port', function(done) {
        if (startport) {
            return;
        }
        var portscanner = require('portscanner');
        startport = argv.startport || 3000;
        portscanner.findAPortNotInUse(startport, startport + 50, '127.0.0.1', function(error, port) {
            startport = port;
            done();
        });
    });
    /* Import springbokjs-shim task */

    require('springbokjs-shim/gulptask.js')(gulp, paths.browser.dist);
};


var spawnGulp = !argv.spawnedProcess && function(gulp) {
    return function() {
        var spawn = require('child_process').spawn;
        var childProcess, closed = true;

        var args = process.argv.slice(1);
        args.push('--spawnedProcess');
        var spawnChildren = function (e) {
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
            childProcess = spawn(process.argv[0], args, {stdio: 'inherit'});
            childProcess.on('close', function(code, signal) {
                console.log('child process terminated due to receipt of signal ' + signal);
                closed = true;
            });
        };

        //gulp.watch('gulpfile.js', spawnChildren);
        spawnChildren();
    };
};

module.exports = function(pkg, gulp, options) {
    var notifier = new Notification();
    var _notify = function(title, message) {
        notifier.notify({
            // https://github.com/mikaelbr/node-notifier/blob/master/lib/notifiers/notify-send.js
            message: message === undefined ? title : message,
            title: title || 'Gulp',
            //expire: 2000,
            hint: 'int:transient:1'
        });
    };

    var logAndNotify = function(notifyMessage, doNotLog) {
        return function(err) {
            _notify('Gulp ERROR', notifyMessage || err);
            if (!doNotLog) {
                if (err && !err.fileName && !err.lineNumber && err.message && err.message !== '[object Object]') {
                    console.warn(err.message);
                    console.log(notifyMessage, typeof(err.message), err);
                } else {
                    gutil.log(err);
                }
            }
        };
    };


    /* OPTIONS */

    var paths = objectUtils.extend({
        scripts: "**/*.js",
        'public': 'public/',
        browser: {},
        server: 'src/server/',
        config: 'src/config/',
        bowerPath: 'bower_components/'
    }, options.paths);
    paths.common = objectUtils.extend({
        src: false,/*{
            browser: 'src/common/browser/',
            common: 'src/common/common/',
            server: 'src/common/server/',
        }*/
        dest: 'lib/common/', // destination for server-side.
    }, paths.common);
    paths.browser = objectUtils.extend({
        src: 'src/browser/',
        dist: 'public/dist/',
        mainscripts: "js/" + pkg.name + ".js",
        styles: 'style/',
        mainstyle: 'main.less',
        templatesEJS: 'templates/',
        images: "images",
    }, paths.browser);

    if (!Array.isArray(paths.browser.mainscripts)) {
        paths.browser.mainscripts = [ paths.browser.mainscripts ];
    }
    paths.server = paths.server !== false && objectUtils.extend({
        common: 'src/common/',
        dist: 'lib/server/',
        startfile: 'server.js',
        templatesEJS: '**/*.ejs',
        templatesJSX: '**/*.jsx',
        configdest: 'lib/'
    }, S.isString(paths.server) ? { src: paths.server } : paths.server);

    options.prefix = options.prefix || '';
    options.paths = paths;
    options.argv = argv;

    /* Config */
    gulp.task(options.prefix + 'init-config', function(done) {
        if (!argv.env) {
            return done();
        }
        fs.mkdir(paths.server.configdest)
            .then(then)
            .catch(then);
        function then() {
            Promise.all([
                fs.readYamlFile(paths.config + 'common.yml').catch(function() { }),
                fs.readYamlFile(paths.config + argv.env + '.yml'),
                fs.readYamlFile(paths.config + 'local.yml').catch(function() { }),
            ]).then(function(results) {
                var config = results[0] || {};
                'common browser server'.split(' ').forEach(function(key) {
                    config[key] = config[key] || {};
                    Object.assign(config[key], results[1][key] || {}, results[2] && results[2][key] || {});
                });
                options.browserConfig = Object.assign({
                    basepath: '/',
                }, config.common || {}, config.browser || {}, {
                    production: !!argv.production,
                });
                options.serverConfig = Object.assign(config.common || {}, config.server || {});
                return fs.writeFile(paths.server.configdest + 'config.js',
                 'module.exports = ' + JSON.stringify(options.serverConfig, null, 4));
            })
            .then(function() {
                done();
            })
            .catch(function(err) {
                console.error(err);
                done(err);
            });
        }
    });

    /* Init : tasks only applied once */
    init(gulp, options);

    var tasks = [
        /* Styles */
        require('./tasks/browser-styles.js'),
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

    gulp.task(options.prefix + 'browser-images', function() {
        return gulp.src(paths.browser.src + paths.browser.images + '/**/*', { base: paths.browser.src + paths.browser.images })
            .pipe(gulp.dest(paths.public + 'images/'));
    });

    gulp.task(options.prefix + 'browser-imagesmin', [options.prefix + 'browser-images'], function() {
        return gulp.src(paths.browser.src + paths.browser.images + '/**/*', { base: paths.browser.src + paths.browser.images })
            .pipe(plugins.imagemin({ progressive: true }))
            .pipe(gulp.dest(paths.public + 'images/'));
    });


    /* Tasks */

    gulp.task(options.prefix + 'browser-js', [options.prefix + 'browser-lintjs', options.prefix + 'browserifyjs']);
    //gulp.task(options.prefix + 'browser-css', [options.prefix + 'browser-concatcss']);
    if (paths.server) {
        gulp.task(options.prefix + 'server-js', [options.prefix + 'server-lintjs', options.prefix + 'server-buildjs']);
    }

    //gulp.task('build', ['cssmin', 'jsmin', 'ejsmin', 'imagesmin']);
    var tasksDefault = [
        options.prefix + 'browser-styles',
        options.prefix + 'browser-js',
        options.prefix + 'browser-ejs',
        options.prefix + 'browser-images'
    ];
    if (paths.browser.independantStyles) {
        tasksDefault.push(options.prefix + 'browser-independant-styles');
    }
    if (argv.env) {
        tasksDefault.unshift(options.prefix + 'init-config');
    }
    if (paths.server !== false) {
        tasksDefault.push.apply(tasksDefault, [
            options.prefix + 'server-js',
            options.prefix + 'server-templates',
        ]);
    }
    gulp.task(options.prefix + 'default', tasksDefault);

    gulp.task(options.prefix + 'clean', function(done) {
        console.log(paths);
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
        gulp.task(options.prefix + 'watch', spawnGulp(gulp));
    } else {
        gulp.task(options.prefix + 'watch', ['define-port', options.prefix + 'init-config', options.prefix + 'default'], function() {
            var logfileChanged = function(from) {
                return function(file) {
                    console.log('[watch] ' + from + ': ' + file.path);
                };
            };

            var port = startport + (options.multiIndex || 0);
            var livereloadPort = (argv.startlivereloadPort || (startport + 100)) + (options.multiIndex || 0);
            console.log('create livereload server on port '+ livereloadPort);
            var livereloadServer = tinylr({ port: livereloadPort });
            var changed = function(filePath) {
                if (filePath.substr(-4) === '.map') {
                    // ignore reload for source map files
                    return;
                }
                console.log('[livereload] ' + filePath);
                livereloadServer.changed({ params: { files: [ filePath ] }});
            };

            var daemon;
            if (paths.server) {
                daemon = require('springbokjs-daemon').node([
                    '--harmony', paths.server.dist + paths.server.startfile,
                    '--port=' + port,
                    '--livereloadPort=' + livereloadPort
                ]);

                process.on('exit', function(code) {
                    daemon.stop();
                    livereloadServer.close();
                });
            }

            watchTasks.forEach(function(task) {
                task(logfileChanged);
            });




            gulp.watch(paths.browser.src + paths.browser.images, [options.prefix + 'browser-images'])
                .on('change', logfileChanged('images'));


            livereloadServer.listen(livereloadPort, function() {
                if (paths.server) {
                    daemon.start();

                    gulp.watch([
                        paths.server.dist + '**/*',
                        paths.common.dest + '**/*' ,
                        paths.server.configdest + 'config.js',
                    ]).on('change', function(file) {
                        logfileChanged('server')(file);
                        daemon.restart();
                        daemon.once('stdout', function(data) {
                            var string = data.toString().toLowerCase();
                            if (string.indexOf('listening') !== -1) {
                                changed(file.path);
                                _notify("Server restarted");
                            }
                        });
                    });
                } else {
                    var express = require('express');
                    var app = express();
                    app.use(express.static(paths.public));
                    app.use('/src', express.static('src/'));
                    app.listen(port, gutil.log.bind(null,'static server started, listening on port ' + gutil.colors.magenta(port)));
                }
            });

            gulp.watch(['data/**/*', paths.browser.dist + '**/*'])
                .on('change', function(file) {
                    logfileChanged('data&dist')(file);
                    changed(file.path);
                });
        });
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
    ['default', 'watch', 'clean'].forEach(function(task) {
        var tasks = prefixes.map(function(prefix) {
            return prefix + '-' + task;
        });
        if (task === 'watch') {
            if (spawnGulp) {
                tasks = spawnGulp(gulp);
            } else {
                tasks.unshift('define-port');
            }
        }
        gulp.task(task, tasks);
    });
};
