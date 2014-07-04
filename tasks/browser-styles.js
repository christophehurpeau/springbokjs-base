var eventStream = require('event-stream');
var gutil = require('gulp-util');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;
    var fn, regexp;

    if (options.stylus) {
        regexp = /\.styl$/;
        fn = plugins.stylus({ errors: true });
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
        };
        fn = plugins.less(lessOptions).on('error', logAndNotify('Less failed'));
                /*.pipe(recess(objectUtils.extend({
                    noOverqualifying: false
                }, options.recessOptions)).on('error', logAndNotify('Recess failed')))*/
    }

    if (paths.browser.independantStyles) {
        console.warn('springbokjs-base: browser.independantStyles will be deprecated soon');
        gulp.task(options.prefix + 'browser-independant-styles', function() {
            return gulp.src(paths.browser.independantStyles, { base: paths.browser.src })
                .pipe(fn)
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
        return eventStream.merge.apply(eventStream, mainstyles.map(function(mainstyle) {
            var currentSrc = src[mainstyle] || [];
            currentSrc.push(paths.browser.src + paths.browser.styles + mainstyle);
            
            return gulp.src(currentSrc, { base: paths.browser.src + paths.browser.styles })
                .pipe(plugins.sourcemaps.init())
                .pipe(plugins.if(regexp, fn))
                .pipe(plugins.concat(mainstyle.replace(regexp, '') + /* '-' + pkg.version +*/ '.css'))
            .pipe(plugins.sourcemaps.write('maps/' , { sourceRoot: '/' + paths.browser.src + paths.browser.styles }))
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
        gulp.watch([ paths.browser.src + '**/*.less', paths.browser.src + '**/*.css' ],
                                        [options.prefix + 'browser-styles'])
            .on('change', logfileChanged('css&less'));
    };
};


