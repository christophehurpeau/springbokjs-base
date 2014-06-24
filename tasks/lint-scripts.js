var through2 = require('through2');
var gutil = require('gulp-util');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;

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

    var jshintOptions = Object.assign({
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
    }, options.jshintOptions || {});
    options.jshintBrowserOptions = Object.assign(options.jshintBrowserOptions || {},
                                                        {"browser": true}, jshintOptions);
    options.jshintServerOptions = Object.assign(options.jshintServerOptions || {},
                                                        {"browser": false}, jshintOptions);

    gulp.task(options.prefix + 'browser-lintjs', function() {
        return gulp.src([
                paths.browser.src + paths.scripts,
                paths.common.src && paths.common.src.browser && (paths.common.src.browser + paths.scripts),
                paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                paths.browser.common && (paths.browser.common + paths.scripts)
            ].filter(function(elt) { return !!elt; }))
            //.pipe(insert.prepend("\"use strict\";     "))
            .pipe(plugins.jshint(options.jshintBrowserOptions))
            .pipe(jshintReporter(options.prefix + 'browser'))
            .pipe(plugins.jshint.reporter('jshint-stylish'));
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
                .pipe(plugins.jshint(options.jshintServerOptions))
                .pipe(jshintReporter(options.prefix + 'server'))
                .pipe(plugins.jshint.reporter('jshint-stylish'));
        });
    }
};