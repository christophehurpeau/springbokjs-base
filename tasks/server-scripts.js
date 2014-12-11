var merge = require('merge-stream');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    if (!paths.server) {
        return;
    }

    var sourceRoot = function(src, dest, file) {
        var slashMatches = file.relative.match(/\//g);
        return '../'.repeat(dest.replace(/\/+$/, '').split('/').length)
                         + (slashMatches && '../'.repeat(slashMatches.length) || '')
                         + src.replace(/\/+$/, '');
    };

    gulp.task(options.prefix + 'server-buildjs', [options.prefix + 'server-common-js'], function() {
        var logPrefix = options.prefix + 'server-buildjs: ';
        return gulp.src(paths.server.src + paths.scripts, { base: paths.server.src })
            .pipe(plugins.changed(paths.server.dist))
            .pipe(plugins.plumber())
            .pipe(plugins.sourcemaps.init())
                .pipe(plugins.es6to5(options.es6to5Options)
                            .on('error', logAndNotify(logPrefix + 'es6to5 failed')))
            .pipe(plugins.sourcemaps.write('.' , {
                addComment: true,
                includeContent: false,
                sourceRoot: sourceRoot.bind(null, paths.server.src, paths.server.dist)
            }))
            .pipe(gulp.dest(paths.server.dist));
    });

    var commonScripts = [
        paths.common.src && paths.common.src.server,
        paths.common.src && paths.common.src.common,
        paths.server.common && paths.server.common
    ].filter(function(elt) { return !!elt; });

    gulp.task(options.prefix + 'server-common-js', function() {
        var logPrefix = options.prefix + 'server-common-js: ';
        return merge.apply(merge, commonScripts.map(function(basesrc) {
            return gulp.src(basesrc + paths.scripts)
                .pipe(plugins.changed(paths.common.dest))
                .pipe(plugins.plumber())
                .pipe(plugins.sourcemaps.init())
                    .pipe(plugins.es6to5(options.es6to5Options)
                                .on('error', logAndNotify(logPrefix + 'es6to5 failed')))
                .pipe(plugins.sourcemaps.write('.' , {
                    addComment: true,
                    includeContent: false,
                    sourceRoot: sourceRoot.bind(null, basesrc, paths.common.dest)
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
