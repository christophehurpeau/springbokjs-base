/* jshint maxlen: 200 */
var merge = require('merge-stream');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    if (!paths.server) {
        return;
    }
    var sourceRoot = function(src, dest, file) {
        var slashMatches = file.relative.match(/\//g);
        return '../'.repeat(dest.replace(/\/+$/, '').split('/').length) +
                (slashMatches && '../'.repeat(slashMatches.length) || '') +
                src.replace(/\/+$/, '');
    };

    var srcServerTemplatesPart = [
        paths.server.src,
        paths.common.src && paths.common.src.server && (paths.common.src.server),
        paths.common.src && paths.common.src.common && (paths.common.src.common),
        paths.server.common && (paths.server.common)
    ].filter(function(elt) { return !!elt; });

    // .pipe(ejs({ compileDebug: true, client: false }).on('error', logAndNotify('EJS compile failed')))
    var serverTemplates = [];
    var watchPaths = [];

    [
        {
            suffix: 'ejs',
            path: paths.templatesEJS
        },
        {
            suffix: 'jsx',
            path: paths.templatesJSX,
            isJs: true,
            pipe: plugins.react
        }
    ].forEach(function(templateOptions) {
        if (!templateOptions.path) {
            return;
        }
        var taskName = options.prefix + 'server-' + templateOptions.suffix;
        serverTemplates.push(taskName);

        gulp.task(taskName, function() {
            if (!templateOptions.pipe) {
                var srcServerTemplates = srcServerTemplatesPart.map(function(v) { return v + templateOptions.path; });
                return gulp.src(srcServerTemplates)
                    .pipe(plugins.changed(paths.server.dist))
                    .pipe(gulp.dest(paths.server.dist));
            }

            return merge.apply(merge, srcServerTemplatesPart.map(function(basesrc) {
                var logPrefix = templateOptions.suffix.toUpperCase();
                watchPaths.push(['templates' + logPrefix, basesrc + templateOptions.path, taskName]);
                return gulp.src(basesrc + templateOptions.path, { base: basesrc })
                    .pipe(plugins.changed(paths.server.dist/*, { extension: 'js' }*/))
                    .pipe(plugins.sourcemaps.init())
                        .pipe(templateOptions.pipe(templateOptions.pipeOptions || {}).on('error', logAndNotify(logPrefix + ' compile failed')))
                        .pipe(plugins.if(templateOptions.isJs, plugins.babel(options.babelOptions)
                                    .on('error', logAndNotify(logPrefix + 'babel failed'))))
                    .pipe(plugins.sourcemaps.write('.' , {
                        addComment: true,
                        includeContent: true,
                        sourceRoot: sourceRoot.bind(null, basesrc, paths.server.dist)
                    }))
                    .pipe(gulp.dest(paths.server.dist));
            }));
        });
    });

    gulp.task(options.prefix + 'server-templates', serverTemplates);

    return function(logfileChanged) {
        watchPaths.forEach(function(watchOptions) {
            gulp.watch(watchOptions[1], [watchOptions[2]])
                    .on('change', logfileChanged('server.' + watchOptions[0]));
        });
    };
};
