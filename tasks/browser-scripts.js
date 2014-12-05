/* jshint maxlen: 200 */
var through2 = require('through2');
var gutil = require('gulp-util');
var merge = require('merge-stream');
var path = require('path');
var applySourceMap = require('vinyl-sourcemaps-apply');

var browserify = require('browserify');
var es6to5ify = require('6to5-browserify');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;

    var src = options.src && options.src.js || [];
    var mainscripts = paths.browser.mainscripts;
    if (Array.isArray(src)) {
        if (mainscripts.length > 1) {
            gutil.log(gutil.colors.red.bold('the configuration array options.src.js' +
                    ' should be defined for each of yours mainscripts'));
        }
        var oldSrc = src;
        src = {};
        src[mainscripts[0]] = oldSrc;
    }

    var commonScripts = [
        paths.common.src && paths.common.src.browser,
        paths.common.src && paths.common.src.common,
        paths.browser.common
    ].filter(function(elt) { return !!elt; });


    var preScriptsBrowserify = [options.prefix + 'init-config'];
    var requireRecursiveFolder = paths.browser.requireRecursiveFolder;
    if (requireRecursiveFolder) {
        preScriptsBrowserify.push(options.prefix + 'requireRecursiveFolder');
        gulp.task(options.prefix + 'requireRecursiveFolder', [options.prefix + 'init-config'], function() {
            return merge.apply(merge, Object.keys(requireRecursiveFolder).map(function(dest) {
                var dir = requireRecursiveFolder[dest];
                var src = [ paths.browser.src + paths.browser.js + dir + paths.scripts ];
                commonScripts.forEach(function(commonbase) {
                    src.push(commonbase + dir + paths.scripts);
                });
                return gulp.src(src, { read: false })
                    .pipe(plugins.setContents(function(file) {
                        if (file.relative.slice(-3) !== '.js') {
                            return '';
                        }
                        var relativePath = path.relative(paths.browser.src + paths.browser.js, file.path).slice(0, -3);
                        var fileName = path.basename(relativePath);
                        return '\t' + fileName + ": require('./" + relativePath + '\'),';
                    }))
                    .pipe(plugins.concat(dest))
                    .pipe(plugins.insert.wrap('module.exports = {\n', '\n};\n'))
                    .pipe(gulp.dest(paths.browser.src + paths.browser.js));
            }));
        });

    }


    gulp.task(options.prefix + 'browserifyjs', preScriptsBrowserify, function() {
        return merge.apply(merge, mainscripts.map(function(mainscript) {
            var currentSrc = src[mainscript] || [];
            currentSrc.push(paths.browser.src + paths.browser.js + mainscript);
            currentSrc.unshift('node_modules/springbokjs-base/src/init.js');

            return gulp.src(currentSrc, { base: paths.browser.src })
                // .pipe(plugins.es6to5())
                .pipe(plugins.sourcemaps.init())
                    .pipe(through2.obj(function(file, encoding, next) {
                        if (file.relative === paths.browser.js + mainscript) {
                            browserify({ debug: !options.argv.production })
                                .transform(es6to5ify.configure(options.es6to5BrowserOptions))
                                .require(file, { entry: file.path, basedir: paths.browser.src + paths.browser.js })
                                .bundle(function(err, source) {
                                    if (err) {
                                        this.emit('error', new gutil.PluginError('task browserifyjs', err));
                                        return next();
                                    }
                                    // //# sourceMappingURL=data:application/json;base64,
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
                    // .pipe(rename(pkg.name + /*'-' + pkg.version +*/ '.js'))
                    .pipe(plugins.concat(path.basename(mainscript).slice(0, -3) + /*'-' + pkg.version +*/ '.js'))
                    .pipe(plugins.uglify({
                        mangle: false,
                        compress: {
                            warnings: false,
                            'global_defs': {  // jshint ignore:line
                                production: !!options.argv.production,
                                basepath: options.browserConfig.basepath,
                                webpath: options.browserConfig.webpath
                            },
                            'drop_debugger': !!options.argv.production,
                            unsafe: true, // !oldIe
                            unused: false, // important keep the function name
                            comparisons: true,
                            sequences: false
                        },
                        output: {
                            beautify: !options.argv.production && {
                                'max-line-len': 200,
                                bracketize: true,
                            }
                        },
                        comments: !options.argv.production && 'all',
                    }).on('error', logAndNotify('uglify failed')))
                    .pipe(plugins.if(false && options.argv.production, plugins.closure({
                        'language_in': 'ECMASCRIPT5_STRICT',
                        // formatting: options.argv.production ? null : 'PRETTY_PRINT'
                    }).on('error', logAndNotify('closure compiler failed'))))
                .pipe(plugins.sourcemaps.write('maps/' , { sourceRoot: '/' + paths.browser.src }))
                .pipe(gulp.dest(paths.browser.dist + paths.browser.js));
        }));
    });

    return function(logfileChanged) {
        gulp.watch(paths.browser.src + paths.scripts, [options.prefix + 'browser-js'])
            .on('change', logfileChanged('browser.scripts'));
        commonScripts.forEach(function(commonbase) {
            gulp.watch(commonbase + paths.scripts, [options.prefix + 'browser-js'])
                .on('change', logfileChanged('browser.commonScripts'));
        });
    };

};
