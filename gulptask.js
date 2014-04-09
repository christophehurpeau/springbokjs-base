module.exports = function(pkg, gulp, options) {

    var gutil = require('gulp-util');
    var plumber = require('gulp-plumber');
    var concat = require('gulp-concat-sourcemap');
    var recess = require('gulp-recess');
    var less = require('gulp-less');
    var csso = require('gulp-csso');
    var jshint = require('gulp-jshint');
    var uglify = require('gulp-uglify');
    var insert = require('gulp-insert');
    var ejs = require('gulp-ejs-precompiler');
    var clean = require('gulp-clean');
    var rename = require('gulp-rename');
    //var notify = require('gulp-notify');
    var livereload = require('gulp-livereload');


    
    var Notification = require("node-notifier");
    var notifier = new Notification();
    var _notify = function(title, message) {
        notifier.notify({
            message: message === undefined ? title : message,
            title: title || 'Gulp'
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
            scripts: "src/browser/**/*.js",
            styles: 'src/browser/style/main.less',
            templatesEJS: 'src/browser/templates/**/*.ejs',
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
            .pipe(recess({
                noOverqualifying: false
            }).on('error', logAndNotify('Recess failed')))
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

    gulp.task('lintjs', function() {
        var through2 = require('through2');
        var myReporter = through2.obj(function (file, enc, next) {
            if (!file.jshint.success) {
                logAndNotify('jshint failed', true)();
            }
            next();
        });


        return gulp.src([ 'gulpfile.js', paths.browser.scripts ])
            .pipe(plumber())
            .pipe(jshint())
            .pipe(jshint.reporter('jshint-stylish'))
            .pipe(myReporter);
    });

    gulp.task('concatjs', function() {
        var src = options.src.js || [];
        src.push(paths.browser.scripts)
        return gulp.src(src)
            .pipe(concat(pkg.name + /*'-' + pkg.version +*/ '.js'))
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

    gulp.task('js', ['lintjs', 'concatjs']);
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
