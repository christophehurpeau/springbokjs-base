var gutil = require('gulp-util');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;

    gulp.task(options.prefix + 'browser-public', function() {
        return gulp.src(paths.browser.src + paths.public + '**/*')
            .pipe(gulp.dest(paths.public));
    });

    return function(logfileChanged) {
        gulp.watch([
                paths.browser.src + 'public/**/*',
            ], [options.prefix + 'browser-public'])
                .on('change', logfileChanged('public'));
    };
};


