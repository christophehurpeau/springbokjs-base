var through2 = require('through2');
var gutil = require('gulp-util');
var eventStream = require('event-stream');
var path = require('path');
var applySourceMap = require('vinyl-sourcemaps-apply');

var browserify = require('browserify');
var es6ify = require('es6ify');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;

    gulp.task(options.prefix + 'browserifyjs', ['init-config'], function() {
        var src = options.src && options.src.js || [];
        if (Array.isArray(src)) {
            if (paths.browser.mainscripts.length > 1) {
                gutil.log(gutil.colors.red.bold('the configuration array options.src.js'
                        + ' should be defined for each of yours mainscripts'));
            }
            var oldSrc = src;
            src = {};
            src[paths.browser.mainscripts[0]] = oldSrc;
        }

        return eventStream.merge.apply(eventStream, paths.browser.mainscripts.map(function(mainscript) {
            var currentSrc = src[mainscript] || [];
            currentSrc.push(paths.browser.src + mainscript);
            currentSrc.unshift('node_modules/springbokjs-base/src/init.js');

            return gulp.src(currentSrc, { base: paths.browser.src })
                //.pipe(es6transpiler({ }).on('error', logAndNotify('es6transpiler failed')))
                .pipe(plugins.sourcemaps.init())
                    .pipe(through2.obj(function(file, encoding, next) {
                        //TODO fix that !!!!
                        file.on = function(e, c){
                            /* jshint ignore:start */
                            if (e === 'end') process.nextTick(c);
                            else if (e === 'data') c(file.contents);
                            else if (e === 'error') ;
                            else if (e === 'close' || e === 'destroy' || e === 'pause' || e === 'resume') ;
                            else throw new Error(e);
                            /* jshint ignore:end */
                        };
                        if (file.relative === mainscript) {
                            var bundle = browserify()
                                .add(es6ify.runtime)
                                .transform(es6ify)
                                .require(file, { entry: file.path, basedir: file.base });
                            if (options.browserify && options.browserify[mainscript]
                                         && options.browserify[mainscript].beforeBundle) {
                                options.browserify[mainscript].beforeBundle(bundle);
                            }
                            bundle
                                .bundle({ debug: true }, function(err, source) {
                                    if (err) {
                                        this.emit('error', new gutil.PluginError('task browserifyjs', err));
                                        return next();
                                    }
                                    ////# sourceMappingURL=data:application/json;base64,
                                    var m = /^[ \t]*(?:\/\/|\/\*)[@#][ \t]+sourceMappingURL=data:(?:application|text)\/json;base64,(.+)(?:\*\/)?/mg.exec(source);

                                    var sourceMapContent = m && m[1];
                                    if (sourceMapContent) {
                                        sourceMapContent = new Buffer(sourceMapContent, 'base64').toString();
                                        var sourceMap = JSON.parse(sourceMapContent);
                                        sourceMap.sources = sourceMap.sources.map(function(filePath) {
                                            return path.relative(file.cwd + '/' + file.base, filePath);
                                        });
                                        applySourceMap(file, sourceMap);
                                    }
                                    file.contents = new Buffer(source);
                                    this.push(file);
                                    next();
                                }.bind(this));
                        } else {
                            this.push(file);
                            next();
                        }
                    }).on('error', logAndNotify('browserify failed')))
                    //.pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.js'))
                    .pipe(plugins.concat(path.basename(mainscript).slice(0, -3) + /*'-' + pkg.version +*/ '.js'))
                    .pipe(plugins.uglify({
                        mangle: false,
                        compress: {
                            warnings: false,
                            global_defs: options.browserConfig,// jshint ignore:line
                            unsafe: false, //!oldIe
                            comparisons: true,
                            sequences: false
                        },
                        output: { beautify: !!options.argv.production },
                    }))
                .pipe(plugins.sourcemaps.write('maps/' , { sourceRoot: '/' + paths.browser.src }))
                .pipe(gulp.dest(paths.browser.dist));
        }));
    });

    gulp.task(options.prefix + 'jsmin', [options.prefix + 'browserifyjs'], function() {
        gulp.src(paths.browser.dist + '*.js')
            .pipe(plugins.filesize())
            .pipe(plugins.uglify())
            //.pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.min.js'))
            .pipe(plugins.rename(function (path) {
                path.suffix += '-' + pkg.version + '.min';
            }))
            .pipe(gulp.dest(paths.browser.dist))
            .pipe(plugins.filesize());
    });

    return function(logfileChanged) {
        gulp.watch([
                paths.browser.src + paths.scripts,
                paths.common.src && paths.common.src.browser && (paths.common.src.browser + paths.scripts),
                paths.common.src && paths.common.src.common && (paths.common.src.common + paths.scripts),
                paths.browser.common && (paths.browser.common + paths.scripts)
        ].filter(function(elt) { return !!elt; }), [options.prefix + 'browser-js'])
            .on('change', logfileChanged('browser.scripts'));
    };

};