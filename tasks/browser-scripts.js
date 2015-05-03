/* jshint maxlen: 200 */
var merge = require('merge-stream');
var path = require('path');

module.exports = function(gulp, plugins, options, logAndNotify, pkg) {
    var paths = options.paths;

    var commonScripts = [
        paths.common.src && paths.common.src.browser,
        paths.common.src && paths.common.src.common,
        paths.browser.common
    ].filter(function(elt) { return !!elt; });

    var sourceRoot = function(src, dest, file) {
        var slashMatches = file.relative.match(/\//g);
        return '../'.repeat(dest.replace(/\/+$/, '').split('/').length) +
                         (slashMatches && '../'.repeat(slashMatches.length) || '') +
                         src.replace(/\/+$/, '');
    };

    var uglifyOptions;

    gulp.task(options.prefix + 'browser-uglifyOptions', [options.prefix + 'init-config'], function() {
        uglifyOptions = {
            mangle: false,
            compress: {
                warnings: false,
                'global_defs': {  // jshint ignore:line
                    production: !!options.argv.production,
                    basepath: options.browserConfig.basepath,
                    webpath: options.browserConfig.webpath,
                    BROWSER: true,
                    SERVER: false
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
        };
    });

    var preScripts = [options.prefix + 'browser-uglifyOptions'];
    var requireRecursiveFolder = paths.browser.requireRecursiveFolder;
    if (requireRecursiveFolder) {
        preScripts.push(options.prefix + 'requireRecursiveFolder');
        gulp.task(options.prefix + 'requireRecursiveFolder', [options.prefix + 'init-config'], function() {
            return merge.apply(merge, Object.keys(requireRecursiveFolder).map(function(dest) {
                var dir = requireRecursiveFolder[dest];
                var src = paths.browser.src + paths.browser.js + dir;

                var sources = [ gulp.src(src, { base: paths.browser.src + paths.browser.js, read: false }) ];
                commonScripts.forEach(function(commonbase) {
                    sources.push(gulp.src(commonbase + dir, { base: commonbase, read: false }));
                });

                var stream = sources.length === 1 ? sources[0] : merge(sources);

                return stream
                    .pipe(plugins.setContents(function(file) {
                        var dirnameDest = path.dirname(dest);
                        var relativePath = dirnameDest ? path.relative(dirnameDest, file.relative) : file.relative;

                        // var relativePath = file.relative;

                        if (relativePath.slice(-3) === '.js') {
                            relativePath = relativePath.slice(0, -3);
                        }

                        var key = file.relative;
                        if (key.slice(-3) === '.js') {
                            key = key.slice(0, -3);
                        } else if (key.slice(-4) === '.jsx') {
                            key = key.slice(0, -4);
                        }
                        // var fileName = path.basename(relativePath);
                        return '\t\'' + key + "\': require('./" + relativePath + '\'),';
                    }))
                    .pipe(plugins.concat(dest))
                    .pipe(plugins.insert.wrap('module.exports = {\n', '\n};\n'))
                    .pipe(gulp.dest(paths.browser.dist + paths.browser.js));
            }));
        });
    }

    gulp.task(options.prefix + 'browser-buildjs', preScripts, function() {
        var logPrefix = options.prefix + 'browser-buildjs: ';
        return gulp.src(paths.browser.src + paths.scripts, { base: paths.browser.src })
            .pipe(plugins.changed(paths.browser.dist))
            .pipe(plugins.plumber())
            .pipe(plugins.sourcemaps.init())
                .pipe(plugins.babel(options.babelBrowserOptions)
                            .on('error', logAndNotify(logPrefix + 'babel failed')))
            .pipe(plugins.sourcemaps.write('.' , {
                addComment: true,
                includeContent: false,
                sourceRoot: sourceRoot.bind(null, paths.browser.src, paths.browser.dist)
            }))
            // .pipe(plugins.uglify(uglifyOptions).on('error', logAndNotify(logPrefix + 'uglify failed')))
            .pipe(gulp.dest(paths.browser.dist));
    });

    gulp.task(options.prefix + 'browser-common-js', preScripts, function() {
        var logPrefix = options.prefix + 'browser-common-js: ';
        return merge.apply(merge, commonScripts.map(function(basesrc) {
            return gulp.src(basesrc + paths.scripts)
                .pipe(plugins.changed(paths.browser.dist + paths.browser.js))
                .pipe(plugins.plumber())
                .pipe(plugins.sourcemaps.init())
                    .pipe(plugins.babel(options.babelBrowserOptions)
                                .on('error', logAndNotify(logPrefix + 'babel failed')))
                    // .pipe(plugins.uglify(uglifyOptions).on('error', logAndNotify(logPrefix + 'uglify failed')))
                .pipe(plugins.sourcemaps.write('.' , {
                    addComment: true,
                    includeContent: false,
                    sourceRoot: sourceRoot.bind(null, basesrc, paths.browser.dist + paths.browser.js)
                }))
                .pipe(gulp.dest(paths.browser.dist + paths.browser.js));
        }));
    });

    return function(logfileChanged) {
        gulp.watch(paths.browser.src + paths.scripts, [options.prefix + 'browser-js'])
            .on('change', logfileChanged('browser.scripts'));

        // common watch in server-scripts: common only have sense if there is a server too anyway

        if (requireRecursiveFolder) {
            Object.keys(requireRecursiveFolder).forEach(function(dest) {
                var dir = requireRecursiveFolder[dest];
                var src = [ paths.browser.src + paths.browser.js + dir ];
                commonScripts.forEach(function(commonbase) {
                    src.push(commonbase + dir);
                });
                gulp.watch(src, [options.prefix + 'requireRecursiveFolder'])
                    .on('change', logfileChanged('browser.requireRecursiveFolder ' + dir));
            });
        }
    };

};
