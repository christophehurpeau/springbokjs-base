# springbokjs-base [![NPM version][npm-image]][npm-url]

A collection of gulp tasks


## Installation

```
npm install --save-dev gulp springbokjs-base
```

Then create the file `gulpfile.js`:

```js
var gulp = require('gulp');
var pkg = require('./package.json');

require('springbokjs-base/gulptask.js')(pkg, gulp, {
    src: {
        css: [
            // here put css files from bower or node_modules or other assets,
            // included before the main less file in src/browser/less/main.less.
        ],
        js: [
            // here put js files from bower or node_modules or other assets,
            // included before files from src/browser/js/ folder.
            'node_modules/springbokjs-shim/init.js',
            //'node_modules/ejs/ejs.min.js'
        ]
    },
    jshintBrowserOptions: {
        "predef": [ "S" ]
    },
    jshintServerOptions: {
        "predef": [ "S" ]
    },
});
```


## Configuration

You can configure with the options below, the value displayed is the default:

```js
{
    paths: {
        scripts: "**/*.js",
        'public': 'public/',
        config: 'src/config/',
        bowerPath: 'bower_components/',
        common: {
            src: false,
            dest: 'lib/common/', // destination for server-side.
        },
        
        // can be false, a string (the src option)
        server: 'src/server/',
        
        // or an object
        server: {
            src: 'src/server/',
            common: 'src/common/',
            dist: 'lib/server/',
            startfile: 'server.js',
            templatesEJS: '**/*.ejs',
            templatesJSX: '**/*.jsx',
            configdest: 'lib/'
        }
        
        
        browser: {
            src: 'src/browser/',
            dist: 'public/dist/',
            js: 'js/',
            mainscripts: pkg.name + ".js",
            styles: 'style/',
            mainstyle: 'main.less',
            templatesEJS: 'templates/',
            images: "images",
        }
    },

```


[npm-image]: https://img.shields.io/npm/v/springbokjs-base.svg?style=flat
[npm-url]: https://npmjs.org/package/springbokjs-base
