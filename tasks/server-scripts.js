var gutil = require('gulp-util');
var path = require('path');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    if (!paths.server) {
        return;
    }

    var sourceRoot = function(file) {
        var dirname = path.dirname(file.relative) + '/';
        var slashMatches = file.relative.match(/\//);
        return '../'.repeat(paths.server.dist.replace(/\/+$/, '').split('/').length)
                         + (slashMatches && '../'.repeat(slashMatches.length) || '')
                         + paths.server.src.replace(/\/+$/, '') + (dirname === './' ? '/' : '/' + dirname);
    };

    gulp.task(options.prefix + 'server-buildjs', [options.prefix + 'server-common-js'], function() {
        return gulp.src(paths.server.src + paths.scripts, { base: paths.server.src })
            .pipe(plugins.changed(paths.server.dist))
            .pipe(plugins.plumber())
            .pipe(plugins.sourcemaps.init())
                .pipe(plugins.esnext().on('error', logAndNotify('es6transpiler failed')))
                .pipe(plugins.traceur().on('error', logAndNotify('traceur failed')))
            .pipe(plugins.sourcemaps.write('.' , {
                addComment: true,
                includeContent: false,
                sourceRoot: sourceRoot
            }))
            .pipe(gulp.dest(paths.server.dist));
    });

    var commonScripts = [
        paths.common.src && paths.common.src.server,
        paths.common.src && paths.common.src.common,
        paths.server.common && paths.server.common
    ].filter(function(elt) { return !!elt; });

    gulp.task(options.prefix + 'server-common-js', function() {
        return gutil.combine(commonScripts.map(function(basesrc) {
                return gulp.src(basesrc + paths.scripts)
                    .pipe(plugins.changed(paths.common.dest))
                    .pipe(plugins.plumber())
                    .pipe(plugins.sourcemaps.init())
                        .pipe(plugins.esnext({ }).on('error', logAndNotify('es6transpiler failed')))
                        .pipe(plugins.traceur().on('error', logAndNotify('traceur failed')))
                    .pipe(plugins.sourcemaps.write('.' , {
                        addComment: true,
                        includeContent: false,
                        sourceRoot: sourceRoot
                    }))
                    .pipe(gulp.dest(paths.common.dest));
            }));
    });

    return function(logfileChanged) {
        gulp.watch(paths.server.src + paths.scripts, [options.prefix + 'server-js'])
            .on('change', logfileChanged('server.scripts'));
        commonScripts.forEach(function(commonbase) {
            gulp.watch(commonbase + paths.scripts, [options.prefix + 'server-common-js'])
                .on('change', logfileChanged('server.commonScripts'));
        });
    };

};