/* jshint maxlen: 200 */

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;

    var srcBrowserTemplates = [
        paths.browser.src + paths.browser.templatesEJS + '**/*.ejs',
        paths.common.src && paths.common.src.browser && (paths.common.src.browser + paths.browser.templatesEJS + '**/*.ejs'),
        paths.common.src && paths.common.src.common && (paths.common.src.common + paths.browser.templatesEJS + '**/*.ejs'),
        paths.browser.common && (paths.browser.common + paths.browser.templatesEJS + '**/*.ejs')
    ].filter(function(elt) { return !!elt; });

    gulp.task(options.prefix + 'browser-ejs', function() {
        return gulp.src(srcBrowserTemplates)
            .pipe(plugins.ejsPrecompiler({ compileDebug: true, client: true }).on('error', logAndNotify('EJS compile failed')))
            .pipe(plugins.concat(pkg.name + /*'-' + pkg.version +*/ '.templates.js'))
            .pipe(plugins.insert.prepend('window.templates = {};'+"\n"))
            .pipe(gulp.dest(paths.browser.dist));
    });

    gulp.task(options.prefix + 'browser-ejsmin', function() {
        return gulp.src(srcBrowserTemplates)
            .pipe(plugins.ejsPrecompiler({ compileDebug: false, client: true }).on('error', logAndNotify('EJS compile failed')))
            .pipe(plugins.concat(pkg.name + /*'-' + pkg.version +*/ '.templates.min.js'))
            .pipe(plugins.insert.prepend('window.templates = {};'+"\n"))
            .pipe(gulp.dest(paths.browser.dist));
    });

    return function(logfileChanged) {
        gulp.watch(srcBrowserTemplates, [options.prefix + 'browser-ejs'])
            .on('change', logfileChanged('browser.templatesEJS'));
    };
};
