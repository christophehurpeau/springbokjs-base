var gutil = require('gulp-util');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    var compileStyles, regexp;

    if (options.stylus) {
        regexp = /\.styl$/;
        compileStyles = function() {
            return plugins.stylus({
                errors: true,
                paths: options.paths.stylesIncludePath
            });
        };
    } else {
        regexp = /\.less$/;
        var lessOptions = {
            compress: false,
            cleancss: false,
            strictImports: true,
            strictUnits: true,
            sourceMap: true,
            modifyVars: {
                production: !!options.argv.production
            },
            // paths: (file) => { return [ file.dirname, options.paths.bowerPath ]; }
        };
        compileStyles = function() {
            return plugins.less(lessOptions).on('error', logAndNotify('Less failed'));
        };
                /*.pipe(recess(objectUtils.extend({
                    noOverqualifying: false
                }, options.recessOptions)).on('error', logAndNotify('Recess failed')))*/
    }

    if (paths.browser.independantStyles) {
        console.warn('springbokjs-base: browser.independantStyles will be deprecated soon');
        gulp.task(options.prefix + 'browser-independant-styles', function() {
            return gulp.src(paths.browser.independantStyles, { base: paths.browser.src })
                .pipe(compileStyles)
                .pipe(gulp.dest(paths.browser.dist));
        });
    }

    var src = options.src && options.src.css || [];
    var mainstyles = paths.browser.mainstyles || [ paths.browser.mainstyle ];

    if (Array.isArray(src)) {
        if (mainstyles.length > 1) {
            gutil.log(gutil.colors.red.bold('the configuration array options.src.js'
                    + ' should be defined for each of yours mainscripts'));
        }
        var oldSrc = src;
        src = {};
        src[mainstyles[0]] = oldSrc;
    }


    gulp.task(options.prefix + 'browser-styles', function() {
        return gutil.combine(mainstyles.map(function(mainstyle) {
            var currentSrc = src[mainstyle] || [];
            currentSrc.push(paths.browser.src + paths.browser.styles + mainstyle);

            return gulp.src(currentSrc, { base: paths.browser.src + paths.browser.styles })
                .pipe(plugins.sourcemaps.init())
                    .pipe(plugins.if(regexp, compileStyles()))
                    .pipe(plugins.concat(mainstyle.replace(regexp, '') + /* '-' + pkg.version +*/ '.css'))
                .pipe(plugins.sourcemaps.write('maps/' , {
                                sourceRoot: '/' + paths.browser.src + paths.browser.styles }))
                .pipe(gulp.dest(paths.browser.dist));
        }));
    });

    gulp.task(options.prefix + 'browser-styles-min', [options.prefix + 'browser-styles'], function() {
        gulp.src(paths.browser.dist + '*.css')
            .pipe(plugins.csso())
            .pipe(plugins.rename(function (path) {
                path.suffix += '-' + pkg.version + '.min';
            }))
            .pipe(gulp.dest(paths.browser.dist));
    });

    return function(logfileChanged) {
        gulp.watch([
                paths.browser.src + '**/*.styl',
                paths.browser.src + '**/*.less',
                paths.browser.src + '**/*.css'
            ], [options.prefix + 'browser-styles'])
                .on('change', logfileChanged('css&styles'));
    };
};


