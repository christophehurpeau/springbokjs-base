/* jshint maxlen: 200 */
var traceur = require('gulp-traceur');
var es6transpiler = require('gulp-esnext');

var exec = require('child_process').exec;
var path = require('path');
var through2 = require('through2');
var gutil = require('gulp-util');
var eventStream = require('event-stream');
var path = require('path');
var S = require('springbokjs-utils');
var objectUtils = require('springbokjs-utils/object');
var fs = require('springbokjs-utils/fs');
var applySourceMap = require('vinyl-sourcemaps-apply');

var browserify = require('browserify');
var es6ify = require('es6ify');

var changed = require('gulp-changed');
var concat = require('gulp-concat');
var csso = require('gulp-csso');
var ejs = require('gulp-ejs-precompiler');
var filesize = require('gulp-filesize');
var gulpif = require('gulp-if');
var insert = require('gulp-insert');
var jshint = require('gulp-jshint');
var less = require('gulp-less');
var livereload = require('gulp-livereload');
var plumber = require('gulp-plumber');
//var recess = require('gulp-recess');
//var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
//var es6transpiler = require('gulp-es6-transpiler');
var uglify = require('gulp-uglify');
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

var browserConfig, serverConfig;
var init = function(gulp, paths) {
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

    /* Config */
    gulp.task('init-config', function(done) {
        if (!argv.env) {
            return done();
        }
        fs.mkdir(paths.server.configdest)
            .then(then)
            .catch(then);
        function then() {
            Promise.all([
                fs.readYamlFile(paths.config + argv.env + '.yml'),
                fs.readYamlFile(paths.config + 'common.yml'),
            ]).then(function(results) {
                var config = objectUtils.extend(results[1] || {}, results[0]);
                browserConfig = objectUtils.mextend({
                    basepath: '/',
                }, config.common, config.browser, {
                    production: !!argv.production,
                });
                serverConfig = objectUtils.extend(config.common || {}, config.server);
                return fs.writeFile(paths.server.configdest + 'config.js',
                 'module.exports = ' + JSON.stringify(serverConfig, null, 4));
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
                    console.log(typeof(err.message));
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
        configdest: 'lib/'
    }, S.isString(paths.server) ? { src: paths.server } : paths.server);

    options.prefix = options.prefix || '';

    /* Init : tasks only applied once */
    init(gulp, paths);

    /* Styles */

    var lessOptions = {
        compress: false,
        cleancss: false,
        strictImports: true,
        strictUnits: true,
        sourceMap: true,
        modifyVars: {
            production: !!argv.production
        },
    };
    if (paths.browser.independantStyles) {
        gulp.task(options.prefix + 'browser-independant-styles', function() {
            return gulp.src(paths.browser.independantStyles, { base: paths.browser.src })
                /*.pipe(recess(objectUtils.extend({
                    noOverqualifying: false
                }, options.recessOptions)).on('error', logAndNotify('Recess failed')))*/
                .pipe(less(lessOptions).on('error', logAndNotify('Less failed')))
                .pipe(gulp.dest(paths.browser.dist));
        });
    }

    gulp.task(options.prefix + 'browser-styles', function() {
        var src = options.src && options.src.css || [];
        src.push(paths.browser.src + paths.browser.styles + paths.browser.mainstyle);
        gulp.src(src, { base: paths.browser.src + paths.browser.styles })
            .pipe(sourcemaps.init())
                .pipe(gulpif(/.less$/, less(lessOptions).on('error', logAndNotify('Less failed'))))
                .pipe(concat(pkg.name + /* '-' + pkg.version +*/ '.css'))
            .pipe(sourcemaps.write('maps/' , { sourceRoot: '/' + paths.browser.src }))
            .pipe(gulp.dest(paths.browser.dist));
    });

    gulp.task(options.prefix + 'browser-styles-min', [options.prefix + 'browser-styles'], function() {
        gulp.src(paths.browser.dist + '*.css')
            .pipe(csso())
            .pipe(gulp.dest(paths.browser.dist));
    });


    /* Lint Scripts */

    var previousLintJsSuccess = {};
    var jshintReported = {};
    var jshintReporter = function(key) {
        return through2.obj(function (file, enc, next) {
            if (!file.jshint.success) {
                if (!jshintReported[key]) {
                    gutil.log(gutil.colors.red('✖'), 'jshint ' + key);
                    logAndNotify('jshint failed :(' +(previousLintJsSuccess[key] === false ? '' : ' Again !'), true)();
                    jshintReported[key] = true;
                }
                previousLintJsSuccess[key] = false;
            }
            this.push(file);
            next();
        }, function (onEnd) {
            if (!previousLintJsSuccess[key] && !jshintReported[key]) {
                if (previousLintJsSuccess[key] === false) {
                    logAndNotify('jshint successful :)', true)();
                }
                previousLintJsSuccess[key] = true;
                gutil.log(gutil.colors.green('✔'), 'jshint ' + key);
            }
            // reset for next time
            jshintReported[key] = false;
            onEnd();
        });
    };

    var jshintOptions = objectUtils.extend({
        //"globalstrict": true, // because browserify encapsule them in functions
        "esnext": true,
        "camelcase": true,
        "curly": true,
        "freeze": true,
        "indent": 4,
        "latedef": "nofunc",
        "newcap": true,
        "noarg": true,
        "undef": true,
        "unused": "vars",
        "laxbreak": true,
        "maxparams": 8,
        "maxdepth": 6,
        "maxlen": 120,
        "boss": true,
        "eqnull": true,
        "node": true
    }, options.jshintOptions);
    options.jshintBrowserOptions = objectUtils.mextend(options.jshintBrowserOptions || {},
                                                        {"browser": true}, jshintOptions);
    options.jshintServerOptions = objectUtils.mextend(options.jshintServerOptions || {},
                                                        {"browser": false}, jshintOptions);

    gulp.task(options.prefix + 'browser-lintjs', function() {
        return gulp.src([
                paths.browser.src + paths.scripts,
                paths.common.src && paths.common.src.browser && (paths.common.src.browser + paths.scripts),
                paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                paths.browser.common && (paths.browser.common + paths.scripts)
            ].filter(function(elt) { return !!elt; }))
            //.pipe(insert.prepend("\"use strict\";     "))
            .pipe(jshint(options.jshintBrowserOptions))
            .pipe(jshintReporter(options.prefix + 'browser'))
            .pipe(jshint.reporter('jshint-stylish'));
    });

    if (paths.server) {
        gulp.task(options.prefix + 'server-lintjs', function() {
            return gulp.src([
                    'gulpfile.js',
                    paths.server.src + paths.scripts,
                    paths.common.src && paths.common.src.server && (paths.common.src.server + paths.scripts),
                    paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                    paths.server.common && (paths.server.common + paths.scripts)
                ].filter(function(elt) { return !!elt; }), { base: paths.server.src })
                //.pipe(insert.prepend("\"use strict\";     "))
                .pipe(jshint(options.jshintServerOptions))
                .pipe(jshintReporter(options.prefix + 'server'))
                .pipe(jshint.reporter('jshint-stylish'));
        });
    }

    /* Browser scripts */

    gulp.task(options.prefix + 'browserifyjs', ['init-config'], function() {
        var src = options.src && options.src.js || [];
        if (Array.isArray(src)) {
            if (paths.browser.mainscripts.length > 1) {
                gutil.log(gutil.colors.red.bold('the configuration array options.src.js should be defined for each of yours mainscripts'));
            }
            var oldSrc = src;
            src = {};
            src[paths.browser.mainscripts[0]] = oldSrc;
        }

        return eventStream.merge.apply(eventStream, paths.browser.mainscripts.map(function(mainscript) {
            var currentSrc = src[mainscript] || [];
            currentSrc.push(paths.browser.src + mainscript);
            currentSrc.unshift('node_modules/springbokjs-base/src/init.js');

            return gulp.src(currentSrc, { base: paths.browser.src })
                //.pipe(es6transpiler({ }).on('error', logAndNotify('es6transpiler failed')))
                .pipe(sourcemaps.init())
                    .pipe(through2.obj(function(file, encoding, next) {
                        //TODO fix that !!!!
                        file.on = function(e, c){
                            /* jshint ignore:start */
                            if (e === 'end') process.nextTick(c);
                            else if (e === 'data') c(file.contents);
                            else if (e === 'error') ;
                            else if (e === 'close' || e === 'destroy' || e === 'pause' || e === 'resume') ;
                            else throw new Error(e);
                            /* jshint ignore:end */
                        };
                        if (file.relative === mainscript) {
                            var bundle = browserify()
                                .add(es6ify.runtime)
                                .transform(es6ify)
                                .require(file, { entry: file.path, basedir: file.base });
                            if (options.browserify && options.browserify[mainscript]
                                         && options.browserify[mainscript].beforeBundle) {
                                options.browserify[mainscript].beforeBundle(bundle);
                            }
                            bundle
                                .bundle({ debug: true }, function(err, source) {
                                    if (err) {
                                        this.emit('error', new gutil.PluginError('task browserifyjs', err));
                                        return next();
                                    }
                                    ////# sourceMappingURL=data:application/json;base64,
                                    var m = /^[ \t]*(?:\/\/|\/\*)[@#][ \t]+sourceMappingURL=data:(?:application|text)\/json;base64,(.+)(?:\*\/)?/mg.exec(source);

                                    var sourceMapContent = m && m[1];
                                    if (sourceMapContent) {
                                        sourceMapContent = new Buffer(sourceMapContent, 'base64').toString();
                                        var sourceMap = JSON.parse(sourceMapContent);
                                        sourceMap.sources = sourceMap.sources.map(function(filePath) {
                                            return path.relative(file.cwd + '/' + file.base, filePath);
                                        });
                                        applySourceMap(file, sourceMap);
                                    }
                                    file.contents = new Buffer(source);
                                    this.push(file);
                                    next();
                                }.bind(this));
                        } else {
                            this.push(file);
                            next();
                        }
                    }).on('error', logAndNotify('browserify failed')))
                    //.pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.js'))
                    .pipe(concat(path.basename(mainscript).slice(0, -3) + /*'-' + pkg.version +*/ '.js'))
                    .pipe(uglify({
                        mangle: false,
                        compress: {
                            warnings: false,
                            global_defs: browserConfig,// jshint ignore:line
                            unsafe: false, //!oldIe
                            comparisons: true,
                            sequences: false
                        },
                        output: { beautify: !!argv.production },
                    }))
                .pipe(sourcemaps.write('maps/' , { sourceRoot: '/' + paths.browser.src }))
                .pipe(gulp.dest(paths.browser.dist));
        }));
    });

    gulp.task(options.prefix + 'jsmin', [options.prefix + 'browserifyjs'], function() {
        gulp.src(paths.browser.dist + '*.js')
            .pipe(filesize())
            .pipe(uglify())
            //.pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.min.js'))
            .pipe(gulp.dest(paths.browser.dist))
            .pipe(filesize());
    });


    /* Server scripts */

    if (paths.server) {
        gulp.task(options.prefix + 'server-buildjs', function() {
            return gulp.src(paths.server.src + paths.scripts, { base: paths.server.src })
                .pipe(changed(paths.server.dist))
                .pipe(plumber())
                .pipe(es6transpiler({ }).on('error', logAndNotify('es6transpiler failed')))
                .pipe(traceur().on('error', logAndNotify('traceur failed')))
                .pipe(gulp.dest(paths.server.dist));
        });

        gulp.task(options.prefix + 'server-common-js', function() {
            return gulp.src([
                    paths.common.src && paths.common.src.server && (paths.common.src.server + paths.scripts),
                    paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                    paths.server.common && (paths.server.common + paths.scripts)
                ].filter(function(elt) { return !!elt; }))
                .pipe(changed(paths.common.dest))
                .pipe(plumber())
                .pipe(es6transpiler({ }).on('error', logAndNotify('es6transpiler failed')))
                .pipe(traceur().on('error', logAndNotify('traceur failed')))
                .pipe(gulp.dest(paths.common.dest));
        });
    }

    /* Browser Templates */

    gulp.task(options.prefix + 'browser-ejs', function() {
        return gulp.src([
                paths.browser.src + paths.browser.templatesEJS + '**/*.ejs',
                paths.common.src && paths.common.src.browser && (paths.common.src.browser + paths.browser.templatesEJS + '**/*.ejs'),
                paths.common.src && paths.common.src.common && (paths.common.src.common + paths.browser.templatesEJS + '**/*.ejs'),
                paths.browser.common && (paths.browser.common + paths.browser.templatesEJS + '**/*.ejs')
            ].filter(function(elt) { return !!elt; }))
            .pipe(ejs({ compileDebug: true, client: true }).on('error', logAndNotify('EJS compile failed')))
            .pipe(concat(pkg.name + /*'-' + pkg.version +*/ '.templates.js'))
            .pipe(insert.prepend('window.templates = {};'+"\n"))
            .pipe(gulp.dest(paths.browser.dist));
    });

    gulp.task(options.prefix + 'browser-ejsmin', function() {
        return gulp.src(paths.browser.src + paths.browser.templatesEJS + '**/*.ejs')
            .pipe(ejs({ compileDebug: false, client: true }).on('error', logAndNotify('EJS compile failed')))
            .pipe(concat(pkg.name + /*'-' + pkg.version +*/ '.templates.min.js'))
            .pipe(insert.prepend('window.templates = {};'+"\n"))
            .pipe(gulp.dest(paths.browser.dist));
    });


    /* Server Templates */

    if (paths.server) {
        gulp.task(options.prefix + 'server-ejs', function() {
            return gulp.src([
                    paths.server.src + paths.server.templatesEJS,
                    paths.common.src && paths.common.src.server && (paths.common.src.server + paths.server.templatesEJS),
                    paths.common.src && paths.common.src.common && (paths.common.src.common + paths.server.templatesEJS),
                    paths.server.common && (paths.server.common + paths.server.templatesEJS)
                ].filter(function(elt) { return !!elt; }))
                //.pipe(changed(paths.server.dist))
                //.pipe(ejs({ compileDebug: true, client: false }).on('error', logAndNotify('EJS compile failed')))
                .pipe(gulp.dest(paths.server.dist));
        });

        gulp.task(options.prefix + 'server-ejsmin', function() {
            return gulp.src(paths.server.src + paths.server.templatesEJS)
                //.pipe(ejs({ compileDebug: true, client: false }).on('error', logAndNotify('server EJS compile failed')))
                .pipe(gulp.dest(paths.server.dist));
        });
    }


    /* Images */

    gulp.task(options.prefix + 'browser-images', function() {
        return gulp.src(paths.browser.src + paths.browser.images + '/**/*', { base: paths.browser.src + paths.browser.images })
            //.pipe(notify("Image: <%= file.relative %>"))
            .pipe(gulp.dest(paths.public + 'images/'));
    });

    gulp.task(options.prefix + 'browser-imagesmin', [options.prefix + 'browser-images'], function() {
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
        tasksDefault.unshift('init-config');
    }
    if (paths.server !== false) {
        tasksDefault.push.apply(tasksDefault, [
            options.prefix + 'server-js',
            options.prefix + 'server-common-js',
            options.prefix + 'server-ejs',
        ]);
    }
    gulp.task(options.prefix + 'default', tasksDefault);

    gulp.task(options.prefix + 'clean', function() {
        [paths.server && paths.server.dist, paths.browser.dist].forEach(function(path) {
            if (path) {
                console.log('Removing ' + path);
                exec('rm -Rf ' + path);
            }
        });
    });


    /* Watcher */

    gulp.task(options.prefix + 'watch', ['define-port', 'init-config', options.prefix + 'default'], function() {
        var logfileChanged = function(from) {
            return function(file) {
                console.log('[watch] ' + from + ': ' + file.path);
            };
        };

        var port = startport + (options.multiIndex || 0);
        var livereloadPort = (argv.startlivereloadPort || (startport + 100)) + (options.multiIndex || 0);
        var livereloadServer = livereload(livereloadPort);

        var daemon;
        if (paths.server) {
            daemon = require('springbokjs-daemon').node([
                '--harmony', paths.server.dist + paths.server.startfile,
                '--port=' + port,
                '--livereloadPort=' + livereloadPort
            ]);

            process.on('exit', function(code) {
                daemon.stop();
            });
        }

        gulp.watch([
                paths.browser.src + paths.scripts,
                paths.common.src && paths.common.src.browser && (paths.common.src.browser + paths.scripts),
                paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                paths.browser.common && (paths.browser.common + paths.scripts)
        ].filter(function(elt) { return !!elt; }), [options.prefix + 'browser-js'])
            .on('change', logfileChanged('browser.scripts'));
        gulp.watch([ paths.browser.src + '**/*.less', paths.browser.src + '**/*.css' ], [options.prefix + 'browser-styles'])
            .on('change', logfileChanged('css&less'));
        gulp.watch(paths.browser.src + paths.browser.templatesEJS, [options.prefix + 'browser-ejs'])
            .on('change', logfileChanged('ejs'));
        gulp.watch(paths.browser.src + paths.browser.images, [options.prefix + 'browser-images'])
            .on('change', logfileChanged('images'));

        if (paths.server) {
            daemon.start();
            gulp.watch(paths.server.src + paths.scripts, [options.prefix + 'server-js'])
                .on('change', logfileChanged('server.scripts'));
            gulp.watch(paths.server.src + paths.server.templatesEJS, [options.prefix + 'server-ejs'])
                .on('change', logfileChanged('templatesEJS'));

            gulp.watch([
                    paths.common.src && paths.common.src.server && (paths.common.src.server + paths.scripts),
                    paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                    paths.server.common && (paths.server.common + paths.scripts)
            ].filter(function(elt) { return !!elt; }), [options.prefix + 'server-common-js'])
                .on('change', logfileChanged('common.scripts'));

            gulp.watch([ paths.server.dist + '**/*', paths.common.dest + '**/*' ]).on('change', function(file) {
                logfileChanged('server')(file);
                daemon.restart();
                daemon.once('stdout', function(data) {
                    var string = data.toString().toLowerCase();
                    if (string.indexOf('listening') !== -1) {
                        livereloadServer.changed(file.path);
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

        gulp.watch(['data/**/*', paths.browser.dist + '**/*'])
            .on('change', function(file) {
                logfileChanged('data&dist')(file);
                if (file.path.substr(-4) === '.map') {
                    // ignore reload for source map files
                    return;
                }
                livereloadServer.changed(file.path);
            });
    });


    /*
    gulp.task('staticsvr', function(next) {
      var staticS = require('node-static'),
          server = new staticS.Server('./' + dest),
          port = 8080;
      require('http').createServer(function (request, response) {
        request.addListener('end', function () {
          server.serve(request, response);
        }).resume();
      }).listen(port, function() {
        gutil.log('Server listening on port: ' + gutil.colors.magenta(port));
        next();
      });
    });

    gulp.task('watch', ['staticsvr'], function() {
      var server = livereload();
      gulp.watch(dest + '/**').on('change', function(file) {
          server.changed(file.path);
      });
    });
    */
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
            tasks.unshift('define-port');
        }
        gulp.task(task, tasks);
    });
};
