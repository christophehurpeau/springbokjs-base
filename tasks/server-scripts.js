
module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    if (!paths.server) {
        return;
    }

    gulp.task(options.prefix + 'server-buildjs', function() {
        return gulp.src(paths.server.src + paths.scripts, { base: paths.server.src })
            .pipe(plugins.changed(paths.server.dist))
            .pipe(plugins.plumber())
            .pipe(plugins.esnext({ }).on('error', logAndNotify('es6transpiler failed')))
            .pipe(plugins.traceur().on('error', logAndNotify('traceur failed')))
            .pipe(gulp.dest(paths.server.dist));
    });

    gulp.task(options.prefix + 'server-common-js', function() {
        return gulp.src([
                paths.common.src && paths.common.src.server && (paths.common.src.server + paths.scripts),
                paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                paths.server.common && (paths.server.common + paths.scripts)
            ].filter(function(elt) { return !!elt; }))
            .pipe(plugins.changed(paths.common.dest))
            .pipe(plugins.plumber())
            .pipe(plugins.esnext({ }).on('error', logAndNotify('es6transpiler failed')))
            .pipe(plugins.traceur().on('error', logAndNotify('traceur failed')))
            .pipe(gulp.dest(paths.common.dest));
    });

    return function(logfileChanged) {
        gulp.watch(paths.server.src + paths.scripts, [options.prefix + 'server-js'])
            .on('change', logfileChanged('server.scripts'));
        gulp.watch([
            paths.common.src && paths.common.src.server && (paths.common.src.server + paths.scripts),
            paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
            paths.server.common && (paths.server.common + paths.scripts)
        ].filter(function(elt) { return !!elt; }), [options.prefix + 'server-common-js'])
            .on('change', logfileChanged('server.commonScripts'));

    };

};