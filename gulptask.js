/* jshint maxlen: 200 */
require('es6-shim/es6-shim');

var exec = require('child_process').exec;
var S = require('springbokjs-utils');
var objectUtils = require('springbokjs-utils/object');
var fs = require('springbokjs-utils/fs');
var tinylr = require('tiny-lr');

var plugins = require('gulp-load-plugins')();
Object.defineProperty(plugins, 'less', { value: require('gulp-less') });
Object.defineProperty(plugins, 'concat', { value: require('gulp-concat') });
Object.defineProperty(plugins, 'traceur', { value: require('gulp-traceur') });
Object.defineProperty(plugins, 'changed', { value: require('gulp-changed') });
Object.defineProperty(plugins, 'closureCompiler', { value: require('gulp-closure-compiler') });
Object.defineProperty(plugins, 'csso', { value: require('gulp-csso') });
Object.defineProperty(plugins, 'ejsPrecompiler', { value: require('gulp-ejs-precompiler') });
Object.defineProperty(plugins, 'es6Transpiler', { value: require('gulp-es6-transpiler') });
Object.defineProperty(plugins, 'esnext', { value: require('gulp-esnext') });
Object.defineProperty(plugins, 'filesize', { value: require('gulp-filesize') });
Object.defineProperty(plugins, 'if', { value: require('gulp-if') });
Object.defineProperty(plugins, 'imagemin', { value: require('gulp-imagemin') });
Object.defineProperty(plugins, 'insert', { value: require('gulp-insert') });
Object.defineProperty(plugins, 'jshint', { value: require('gulp-jshint') });
Object.defineProperty(plugins, 'notify', { value: require('gulp-notify') });
Object.defineProperty(plugins, 'plumber', { value: require('gulp-plumber') });
Object.defineProperty(plugins, 'recess', { value: require('gulp-recess') });
Object.defineProperty(plugins, 'rename', { value: require('gulp-rename') });
Object.defineProperty(plugins, 'size', { value: require('gulp-size') });
Object.defineProperty(plugins, 'sourcemaps', { value: require('gulp-sourcemaps') });
Object.defineProperty(plugins, 'stylus', { value: require('gulp-stylus') });
Object.defineProperty(plugins, 'uglify', { value: require('gulp-uglify') });
// Object.defineProperty(plugins, 'less', { get: function() { return require('gulp-less'); } });
// Object.defineProperty(plugins, 'concat', { get: function() { return require('gulp-concat'); } });
// Object.defineProperty(plugins, 'traceur', { get: function() { return require('gulp-traceur'); } });
// Object.defineProperty(plugins, 'changed', { get: function() { return require('gulp-changed'); } });
// Object.defineProperty(plugins, 'closureCompiler', { get: function() { return require('gulp-closure-compiler'); } });
// Object.defineProperty(plugins, 'csso', { get: function() { return require('gulp-csso'); } });
// Object.defineProperty(plugins, 'ejsPrecompiler', { get: function() { return require('gulp-ejs-precompiler'); } });
// Object.defineProperty(plugins, 'es6Transpiler', { get: function() { return require('gulp-es6-transpiler'); } });
// Object.defineProperty(plugins, 'esnext', { get: function() { return require('gulp-esnext'); } });
// Object.defineProperty(plugins, 'filesize', { get: function() { return require('gulp-filesize'); } });
// Object.defineProperty(plugins, 'if', { get: function() { return require('gulp-if'); } });
// Object.defineProperty(plugins, 'imagemin', { get: function() { return require('gulp-imagemin'); } });
// Object.defineProperty(plugins, 'insert', { get: function() { return require('gulp-insert'); } });
// Object.defineProperty(plugins, 'jshint', { get: function() { return require('gulp-jshint'); } });
// Object.defineProperty(plugins, 'notify', { get: function() { return require('gulp-notify'); } });
// Object.defineProperty(plugins, 'plumber', { get: function() { return require('gulp-plumber'); } });
// Object.defineProperty(plugins, 'recess', { get: function() { return require('gulp-recess'); } });
// Object.defineProperty(plugins, 'rename', { get: function() { return require('gulp-rename'); } });
// Object.defineProperty(plugins, 'size', { get: function() { return require('gulp-size'); } });
// Object.defineProperty(plugins, 'sourcemaps', { get: function() { return require('gulp-sourcemaps'); } });
// Object.defineProperty(plugins, 'stylus', { get: function() { return require('gulp-stylus'); } });
// Object.defineProperty(plugins, 'uglify', { get: function() { return require('gulp-uglify'); } });
// Object.defineProperty(plugins, 'util', { get: function() { return require('gulp-util'); } });

var gutil = require('gulp-util');
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
                fs.readYamlFile(paths.config + argv.env + '.yml'),
                fs.readYamlFile(paths.config + 'common.yml'),
            ]).then(function(results) {
                var config = Object.assign(results[1] || {}, results[0]);
                options.browserConfig = objectUtils.mextend({
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

                gulp.watch([ paths.server.dist + '**/*', paths.common.dest + '**/*' ]).on('change', function(file) {
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
