module.exports = function(pkg, gulp, options) {
    var objectUtils = require('springbokjs-utils/object');
    /*var concat = (function(){
        var concat = require('gulp-concat-sourcemap');
        return function(filename, options) {
            options = options || {};
            if (!options.sourceRoot) {
                options.sourceRoot = '../';
            }
            return concat(filename, options);
        };
    })();*/
    var through2 = require('through2');
    var gutil = require('gulp-util');
    var browserify = require('browserify');
    var es6ify = require('es6ify');

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
    var recess = require('gulp-recess');
    var rename = require('gulp-rename');
    //var traceur = require('gulp-traceur');
    var uglify = require('gulp-uglify');
    //var notify = require('gulp-notify');

    var argv = require('minimist')(process.argv.slice(2), {
        alias: {
            'production': 'prod'
        }
    });

    var Notification = require("node-notifier");
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

    var paths = objectUtils.extend({
        'public': 'public/',
        dist: 'public/dist/',
        browser: {
            mainscripts: "src/browser/js/app.js",
            scripts: "src/browser/**/*.js",
            styles: 'src/browser/style/main.less',
            templatesEJS: 'src/browser/templates/**/*.ejs',
            images: "src/browser/images/**/*",
        },
        server: {
            scripts: 'src/server/**/*.js',
            server: 'src/server/server.js'
        }
    }, options.paths);
    if (!Array.isArray(paths.browser.mainscripts)) {
        paths.browser.mainscripts = [ paths.browser.mainscripts ];
    }


    /* Import springbokjs-shim task */

    require('springbokjs-shim/gulptask.js')(gulp, paths.dist);


    /* Styles */

    gulp.task('less', function() {
        console.log(paths.browser.styles);
        return gulp.src(paths.browser.styles)
            .pipe(plumber())
            .pipe(recess(objectUtils.extend({
                noOverqualifying: false
            }, options.recessOptions)).on('error', logAndNotify('Recess failed')))
            .pipe(less({
                compress: false,
                cleancss: false,
                strictImports: true,
                strictUnits: true,
                sourceMap: true,
                modifyVars: {
                    production: !!argv.production
                }
            }).on('error', logAndNotify('Less failed')))
            .pipe(gulp.dest(paths.dist));
    });

    gulp.task('concatcss', ['less'], function() {
        var src = options.src.css || [];
        src.push(paths.dist + 'main.css');
        gulp.src(src)
            .pipe(concat(pkg.name + /*'-' + pkg.version +*/ '.css'))
            .pipe(gulp.dest(paths.dist));
    });

    gulp.task('cssmin', ['concatcss'], function() {
        gulp.src(paths.dist + '*.css')
            .pipe(csso())
            .pipe(gulp.dest(paths.dist));
    });

    /* Scripts */

    var previousLintJsSuccess = true;
    gulp.task('lintjs', function() {
        var jshintReported = false;
        var myReporter = through2.obj(function (file, enc, next) {
            if (!file.jshint.success) {
                if (!jshintReported) {
                    gutil.log(gutil.colors.red('✖'), 'jshint');
                    logAndNotify('jshint failed :(' +(previousLintJsSuccess ? '' : ' Again !'), true)();
                    jshintReported = true;
                }
                previousLintJsSuccess = false;
            }
            this.push(file);
            next();
        }, function (onEnd) {
            if (!previousLintJsSuccess && !jshintReported) {
                previousLintJsSuccess = true;
                logAndNotify('jshint successful :)', true)();
                gutil.log(gutil.colors.green('✔'), 'jshint');
            }
            onEnd();
        });


        return gulp.src([ 'gulpfile.js', paths.browser.scripts ])
            .pipe(plumber())
            .pipe(insert.prepend("\"use strict\";\n"))
            .pipe(jshint(objectUtils.mextend(
                {
                    "globalstrict": true, // because browserify encapsule them in functions
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
                    "maxparams": 8,
                    "maxdepth": 6,
                    "maxlen": 120,
                    "boss": true,
                    "eqnull": true,
                    "browser": true,
                },
                options.jshintOptions,
                options.jshintBrowserOptions
            )))
            .pipe(myReporter)
            .pipe(jshint.reporter('jshint-stylish'));
    });

    gulp.task('browserifyjs', ['lintjs'], function() {
        var src = options.src.js || [];
        src.push.apply(src, paths.browser.mainscripts);

        return gulp.src(src)
            .pipe(plumber())
            .pipe(through2.obj(function(file, encoding, next) {
                if (paths.browser.mainscripts.indexOf(file.path.substr(file.cwd.length  + 1 )) !== -1) {
                    var self = this, endWhen0 = 1;
                    var decrement = function() {
                        if (--endWhen0 === 0) {
                            next();
                        }
                    }
                    var bundle = browserify()
                        .add(es6ify.runtime)
                        .transform(es6ify)
                        .require(file, { entry: file.path, basedir: file.base });
                    if (options.browserify && options.browserify.beforeBundle) {
                        options.browserify.beforeBundle(bundle);
                    }
                    bundle
                        .bundle({ debug: !argv.production }, function(err, source) {
                            if (err) {
                                self.emit('error', new gutil.PluginError('task browserifyjs', err));
                                return decrement();
                            }
                            file.contents = new Buffer(source);
                            self.push(file);
                            decrement();
                        });
                } else {
                    this.push(file);
                    next();
                }
            }).on('error', logAndNotify('browserify failed')))
            //.pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.js'))
            .pipe(concat(pkg.name + /*'-' + pkg.version +*/ '.js'))
            .pipe(insert.prepend('var basepath = ' + JSON.stringify(argv.basepath || '/') + ";\n"))
            //.pipe(traceur({ modules: 'register' }))
            // TODO : merge source maps
            .pipe(uglify({
                //outSourceMap: true,
                mangle: false,
                compress: false,
                output: { beautify: true },
            }))
            .pipe(gulp.dest(paths.dist));
    });

    gulp.task('jsmin', ['browserifyjs'], function() {
        gulp.src(paths.dist + '*.js')
            .pipe(filesize())
            .pipe(uglify())
            //.pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.min.js'))
            .pipe(gulp.dest(paths.dist))
            .pipe(filesize());
    });


    /* Templates */


    gulp.task('ejs', function() {
        return gulp.src(paths.browser.templatesEJS)
            .pipe(plumber())
            .pipe(ejs({
                compileDebug: true,
                client: true
            }).on('error', logAndNotify('EJS compile failed')))
            .pipe(concat(pkg.name + /*'-' + pkg.version +*/ '.templates.js'))
            .pipe(insert.prepend('window.templates = {};'+"\n"))
            .pipe(gulp.dest(paths.dist));
    });

    gulp.task('ejsmin', ['ejs'], function() {
    });

    /* Images */

    gulp.task('images', function() {
        return gulp.src(paths.browser.images)
            //.pipe(notify("Image: <%= file.relative %>"))
            .pipe(gulp.dest(paths['public'] + 'images/'));
    });

    gulp.task('imagesmin', ['images'], function() {
    });


    /* Tasks */

    gulp.task('js', ['lintjs', 'browserifyjs']);
    gulp.task('css', ['concatcss']);

    /* Watcher */

    var port = argv.port || 3000;
    var livereloadPort = argv.livereloadPort || (port + 100);
    var daemon = require('springbokjs-daemon').node([
        '--harmony', paths.server.server,
        '--port=' + port,
        '--livereloadPort=' + livereloadPort
    ]);

    process.on('exit', function(code) {
        daemon.stop();
    });

    gulp.task('watch', ['default'], function() {
        daemon.start();
        var livereloadServer = livereload(livereloadPort);
        var logfileChanged = function(from) {
            return function(file) {
                console.log('[watch] ' + from + ': ' + file.path);
            }
        };


        gulp.watch(paths.browser.scripts, ['js']).on('change', logfileChanged('paths.browser.scripts'));
        gulp.watch([ 'src/**/*.less', 'src/**/*.css' ], ['css']).on('change', logfileChanged('css&less'));
        gulp.watch(paths.browser.templatesEJS, ['ejs']).on('change', logfileChanged('ejs'));
        gulp.watch(paths.browser.images, ['images']).on('change', logfileChanged('images'));

        gulp.watch(['data/**/*', paths.dist + '**/*'])
            .on('change', function(file) {
                logfileChanged('data&dist')(file);
                if (file.path.substr(-4) === '.map') {
                    // ignore reload for source map files
                    return;
                }
                livereloadServer.changed(file.path);
            });
        gulp.watch([ 'src/server/**/*' ]).on('change', function(file) {
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
    });

    //gulp.task('build', ['cssmin', 'jsmin', 'ejsmin', 'imagesmin']);
    gulp.task('default', ['css', 'js', 'ejs', 'images']);




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
