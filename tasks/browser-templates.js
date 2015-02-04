/* jshint maxlen: 200 */
var path = require('path');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    var browserTemplates = [];
    var watchPaths = [];

    if (paths.browser.templates !== false) {
        var sourceRoot = function(file) {
            var dirname = path.dirname(file.relative) + '/';
            var slashMatches = file.relative.match(/\//g);
            return '../' + (slashMatches && '../'.repeat(slashMatches.length) || '')
                             + 'src' + (dirname === './' ? '/' : '/' + dirname);
        };
        var srcBrowserTemplatesPart = [
            paths.browser.src,
            paths.common.src && paths.common.src.browser && (paths.common.src.browser),
            paths.common.src && paths.common.src.common && (paths.common.src.common),
            paths.browser.common && (paths.browser.common)
        ].filter(function(elt) { return !!elt; });


        [
            {
                suffix: 'ejs',
                path: (paths.browser.templates || '') + paths.templatesEJS,
                pipe: plugins.ejsPrecompiler,
                pipeOptions: { compileDebug: !options.argv.production, client: true }
            },
            {
                suffix: 'jsx',
                path: (paths.browser.templates || '') + paths.templatesJSX,
                isJs: true,
                pipe: plugins.react,
                pipeOptions: { domPragma: options.reactDomPragma || '$.create' }
            }
        ].forEach(function(templateOptions) {
            if (!templateOptions.path) {
                return;
            }
            var srcBrowserTemplates = srcBrowserTemplatesPart.map(function(v) { return v + templateOptions.path; });
            var taskName = options.prefix + 'browser-' + templateOptions.suffix;
            browserTemplates.push(taskName);
            watchPaths.push(['templates' + templateOptions.suffix.toUpperCase(), srcBrowserTemplates, taskName]);

            gulp.task(taskName, function() {
                if (!templateOptions.pipe) {
                    return gulp.src(srcBrowserTemplates)
                        .pipe(gulp.dest(paths.server.dist));
                }
                var logPrefix = templateOptions.suffix.toUpperCase();
                return gulp.src(srcBrowserTemplates)
                    .pipe(plugins.sourcemaps.init())
                        .pipe(templateOptions.pipe(templateOptions.pipeOptions || {})
                                    .on('error', logAndNotify(logPrefix + ' compile failed')))
                        .pipe(plugins.if(templateOptions.isJs, plugins.es6to5(options.es6to5Options)
                                    .on('error', logAndNotify(logPrefix + 'es6to5 failed'))))
                        .pipe(plugins.insert.wrap(
                            '(function(exports) {\n',
                            function(file) { return '\n})(window.templates[\'' + file.relative + '\'] = {});'; }
                        ))
                        /*'-' + pkg.version +*/
                        .pipe(plugins.concat(pkg.name + '.templates-' + templateOptions.suffix + '.js'))
                        .pipe(plugins.insert.prepend('window.templates = {};\n'))
                    .pipe(plugins.sourcemaps.write('.' , {
                        addComment: true,
                        includeContent: false,
                        sourceRoot: sourceRoot
                    }))
                    .pipe(gulp.dest(paths.browser.dist));
            });
        });
    }


    gulp.task(options.prefix + 'browser-templates', browserTemplates);

    return function(logfileChanged) {
        watchPaths.forEach(function(watchOptions) {
            gulp.watch(watchOptions[1], [watchOptions[2]])
                    .on('change', logfileChanged('browser.' + watchOptions[0]));
        });
    };
};
