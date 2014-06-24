/* jshint maxlen: 200 */

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    if (!paths.server) {
        return;
    }

    var srcServerTemplaces = [
        paths.server.src + paths.server.templatesEJS,
        paths.common.src && paths.common.src.server && (paths.common.src.server + paths.server.templatesEJS),
        paths.common.src && paths.common.src.common && (paths.common.src.common + paths.server.templatesEJS),
        paths.server.common && (paths.server.common + paths.server.templatesEJS)
    ].filter(function(elt) { return !!elt; });

    if (paths.server) {
        gulp.task(options.prefix + 'server-ejs', function() {
            return gulp.src(srcServerTemplaces)
                //.pipe(changed(paths.server.dist))
                //.pipe(ejs({ compileDebug: true, client: false }).on('error', logAndNotify('EJS compile failed')))
                .pipe(gulp.dest(paths.server.dist));
        });

        gulp.task(options.prefix + 'server-ejsmin', function() {
            return gulp.src(srcServerTemplaces)
                //.pipe(ejs({ compileDebug: true, client: false }).on('error', logAndNotify('server EJS compile failed')))
                .pipe(gulp.dest(paths.server.dist));
        });
    }

    return function(logfileChanged) {
        gulp.watch(srcServerTemplaces, [options.prefix + 'server-ejs'])
                .on('change', logfileChanged('server.templatesEJS'));
    };
};