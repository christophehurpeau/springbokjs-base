module.exports = function(pkg, gulp, options) {
    var objectUtils = require('springbokjs-utils/object');
    var gutil = require('gulp-util');
    var plumber = require('gulp-plumber');
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
    var concat = require('gulp-concat');
    var recess = require('gulp-recess');
    var less = require('gulp-less');
    var csso = require('gulp-csso');
    var jshint = require('gulp-jshint');
    var uglify = require('gulp-uglify');
    var insert = require('gulp-insert');
    var ejs = require('gulp-ejs-precompiler');
    var clean = require('gulp-clean');
    var rename = require('gulp-rename');
    var gulpif = require('gulp-if');
    //var notify = require('gulp-notify');
    var livereload = require('gulp-livereload');
    var through2 = require('through2');
    var browserify = require('browserify');


    var Notification = require("node-notifier");
    var notifier = new Notification();
    var _notify = function(title, message) {
        notifier.notify({
            // https://github.com/mikaelbr/node-notifier/blob/master/lib/notifiers/notify-send.js
            message: message === undefined ? title : message,
            title: title || 'Gulp',
            expire: 2000,
            hint: 'int:transient:1'
        });
    };

    var logAndNotify = function(notifyMessage, doNotLog) {
        return function(err) {
            _notify('Gulp ERROR', notifyMessage || err);
            if (!doNotLog) {
                if (err && !err.fileName && !err.lineNumber && err.message) {
                    console.warn(err.message);
                } else {
                    gutil.log(err);
                }
            }
        };
    };

    var paths = {
        'public': 'public/',
        dist: 'public/dist/',
        browser: {
            mainscript: "src/browser/js/app.js",
            scripts: "src/browser/**/*.js",
            styles: 'src/browser/style/main.less',
            templatesEJS: 'src/browser/templates/*.ejs',
            images: "src/browser/images/**/*",
        },
        server: {
            scripts: 'src/server/**/*.js',
            server: 'src/server/server.js'
        }
    };


    /* Import springbokjs-shim task */

    require('springbokjs-shim/gulptask.js')(gulp, paths.dist);


    /* Clean */
    gulp.task('clean', function() {
        return gulp.src([paths.dist], {read: false}).pipe(clean());
    });


    /* Styles */

    gulp.task('less', function() {
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
                    production: false
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
            if (!previousLintJsSuccess) {
                previousLintJsSuccess = true;
                logAndNotify('jshint successful :)', true)();
                gutil.log(gutil.colors.green('✔'), 'jshint');
            }
            onEnd();
        });


        return gulp.src([ 'gulpfile.js', paths.browser.scripts ])
            .pipe(plumber())
            .pipe(jshint(objectUtils.extend({
                globalstrict: true, // because browserify encapsule them in functions
            }, options.jshintOptions)))
            .pipe(myReporter)
            .pipe(jshint.reporter('jshint-stylish'));
    });

    gulp.task('browserifyjs', function() {
        var src = options.src.js || [];
        src.push(paths.browser.mainscript)
        return gulp.src(src)
            .pipe(plumber())
            .pipe(through2.obj(function(file, encoding, next) {
                if (file.path.substr(file.cwd.length  + 1 ) === paths.browser.mainscript) {
                    var self = this;
                    var bundle = browserify()
                        .require(file, { entry: file.path })
                        .bundle({ debug: !gulp.env.production }, function(err, source) {
                            if (err) {
                                logAndNotify('browserify failed', true)();
                                self.emit('error', new gutil.PluginError('task browserifyjs', err));
                                return;
                            }
                            file.contents = new Buffer(source);
                            self.push(file);
                            next();
                        })
                        .on('error', function (e) {
                            logAndNotify('browserify failed', true)();
                            self.emit('error', new gutil.PluginError('task browserifyjs', e));
                        });
                } else {
                    this.push(file);
                    next();
                }
            }).on('error', logAndNotify('browserify failed')))
            //.pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.js'))
            .pipe(concat(pkg.name + /*'-' + pkg.version +*/ '.js'))
            // TODO : merge source maps
            .pipe(uglify({
                //outSourceMap: true,
                mangle: false,
                compress: false,
                output: { beautify: true },
            }))
            .pipe(gulp.dest(paths.dist));
    });

    gulp.task('jsmin', ['concatjs'], function() {
        gulp.src(paths.dist + '*.js')
            .pipe(uglify())
            .pipe(gulp.dest(paths.dist));
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

    /* Images */

    gulp.task('images', function() {
        return gulp.src(paths.browser.images)
            //.pipe(notify("Image: <%= file.relative %>"))
            .pipe(gulp.dest(paths['public'] + 'images/'));
    });



    /* Tasks */

    var daemon = require('springbokjs-daemon').node([ '--harmony', paths.server.server ]);

    process.on('exit', function(code) {
        daemon.stop();
    });

    gulp.task('js', ['lintjs', 'browserifyjs']);
    gulp.task('css', ['concatcss']);



    gulp.task('watch', ['default'], function() {
        daemon.start();
        var livereloadServer = livereload();

        gulp.watch(paths.browser.scripts, ['js']);
        gulp.watch([ 'src/**/*.less', 'src/**/*.css' ], ['css']);
        gulp.watch(paths.browser.templatesEJS, ['ejs']);
        gulp.watch(paths.browser.images, ['images']);

        gulp.watch(['data/**/*', paths.dist + '**/*'])
            .on('change', function(file) {
                if (file.path.substr(-4) === '.map') {
                    // ignore reload for source map files
                    return;
                }
                livereloadServer.changed(file.path);
            });
        gulp.watch([ 'src/server/**/*' ]).on('change', function(file) {
            daemon.restart();
            _notify("Server restarted");
            livereloadServer.changed(file.path);
        });
    });

    gulp.task('build', ['cssmin', 'jsmin', 'ejsmin', 'imagesmin']);
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
