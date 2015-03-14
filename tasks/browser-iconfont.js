var gutil = require('gulp-util');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;

    gulp.task(options.prefix + 'browser-iconfont', function() {
        return gulp.src(paths.browser.src + paths.browser.iconfont + '**/*.svg')
            .pipe(plugins.iconfont({ fontName: 'icons' }))
            .on('codepoints', function(codepoints, options) {
                return gulp.src(__dirname + '/tools/template-iconfont.styl')
                    .pipe(plugins.consolidate('lodash', {
                        glyphs: codepoints,
                        fontName: 'icons',
                        fontPath: './iconfonts/',
                        className: 'icon',
                        version: pkg.version
                    }))
                    .pipe(plugins.rename('icons.styl'))
                    .pipe(gulp.dest(paths.browser.src + paths.browser.styles + 'iconfonts/'));

            })
            .pipe(gulp.dest(paths.browser.dist + '/iconfonts/icons-' + pkg.version));
    });

    return function(logfileChanged) {
        gulp.watch([
                paths.browser.src + paths.browser.iconfont + '**/*.svg',
            ], [options.prefix + 'browser-iconfont'])
                .on('change', logfileChanged('iconfont'));
    };
};
