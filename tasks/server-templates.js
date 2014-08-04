/* jshint maxlen: 200 */
var path = require('path');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    if (!paths.server) {
        return;
    }
    var sourceRoot = function(file) {
        var dirname = path.dirname(file.relative) + '/';
        var slashMatches = file.relative.match(/\//);
        return '../' + (slashMatches && '../'.repeat(slashMatches.length) || '')
                         + 'src' + (dirname === './' ? '/' : '/' + dirname);
    };

    var srcServerTemplatesPart = [
        paths.server.src,
        paths.common.src && paths.common.src.server && (paths.common.src.server),
        paths.common.src && paths.common.src.common && (paths.common.src.common),
        paths.server.common && (paths.server.common)
    ].filter(function(elt) { return !!elt; });

    //.pipe(ejs({ compileDebug: true, client: false }).on('error', logAndNotify('EJS compile failed')))
    var serverTemplates = [];
    var watchPaths = [];

    [
        { suffix: 'ejs', path: paths.server.templatesEJS },
        // { suffix: 'jsx', path: paths.server.templatesJSX, pipe: plugins.jsx, pipeOptions: {ignoreDocblock: true, jsx: 'DOM'} }
        { suffix: 'jsx', path: paths.server.templatesJSX, pipe: plugins.react, pipeOptions: {} }
    ].forEach(function(templateOptions) {
        if (!templateOptions.path) {
            return;
        }
        var srcServerTemplates = srcServerTemplatesPart.map(function(v) { return v + templateOptions.path; });
        var taskName = options.prefix + 'server-' + templateOptions.suffix;
        serverTemplates.push(taskName);
        watchPaths.push(['templates' + templateOptions.suffix.toUpperCase(), srcServerTemplates, taskName]);


        gulp.task(taskName, function() {
            if (!templateOptions.pipe) {
                return gulp.src(srcServerTemplates)
                    .pipe(gulp.dest(paths.server.dist));
            }
            return gulp.src(srcServerTemplates)
                .pipe(plugins.changed(paths.server.dist/*, { extension: 'js' }*/))
                .pipe(plugins.sourcemaps.init())
                    .pipe(templateOptions.pipe(templateOptions.pipeOptions || {}).on('error', logAndNotify(templateOptions.suffix.toUpperCase() + ' compile failed')))
                    .pipe(plugins.esnext({ }).on('error', logAndNotify('esnext failed')))
                    .pipe(plugins.traceur().on('error', logAndNotify('traceur failed')))
                .pipe(plugins.sourcemaps.write('.' , {
                    addComment: true,
                    includeContent: false,
                    sourceRoot: sourceRoot
                }))
                .pipe(gulp.dest(paths.server.dist));
        });

        gulp.task(taskName + 'min', [taskName], function(done) {
            done();
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