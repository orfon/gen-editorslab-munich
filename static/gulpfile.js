"use strict";

const del = require("del");
const gulp = require("gulp");
const gulpsync = require("gulp-sync")(gulp);
const gulpif = require("gulp-if");
const template = require("gulp-template");
const nunjucks = require("gulp-nunjucks");
const sourcemaps = require("gulp-sourcemaps");
const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
const browserify = require("browserify");
const watchify = require("watchify");
const babelify = require("babelify");
const notify = require("gulp-notify");
const gzip = require("gulp-gzip");
const uglify = require("gulp-uglify");
const gsass = require("gulp-sass");
const cleanCSS = require("gulp-clean-css");
const concat = require("gulp-concat");
const merge = require("merge-stream");
const jshint = require("gulp-jshint");

const paths = {
   "config":   "./config/development",
   "src": {
      "script": "./src/js/main.js",
      "sass": "./src/css/main.scss",
      "images": "./src/images/**",
      "templates": "./src/templates/**.html",
      "nunjucksSlim": "./node_modules/nunjucks/browser/nunjucks-slim.js"
   },
   "dest": {
      "script": "./dist/assets/",
      "sass": {
         "path": "./dist/assets/",
         "file": "build.css"
      },
      "images": "./dist/assets/images/",
      "templates": "./dist/assets/"
   },
   "compress": {
      "src": ["./dist/assets/build.js", "./dist/assets/build.css"],
      "dest": "./dist/assets"
   },
   "watch": {
      "sass": ["./src/css/**/*.scss"],
      "templates": ["./src/templates/**.html"]
   },
   "clean": "./dist/*"
};

// the default environment is the development environment
let env = "development";

/**
 * sets the build environment to the production mode
 * - disables watchify() and all file change watcher
 * - enables uglify() and cleanCSS()
 * - changes the config module to production.js
 */
gulp.task("env:production", function() {
   env = "production";
   paths.config = "./config/production"
});

/**
 * sets the build environment back to the development mode.
 */
gulp.task("env:development", function() {
   env = "development";
   paths.config = "./config/development"
});

/**
 * event logging
 */
const logger = function(event) {
   console.log("File " + event.path + " was " + event.type);
};

const notifyError = notify.onError(function (error) {
   return "Error: " + error.message;
});

/**
 * drops all generated files
 */
function clean() {
   return del.sync(paths.clean);
}

/**
 * copy images to assets
 */
gulp.task("copy:images", function() {
   return gulp.src(paths.src.images)
      .pipe(gulp.dest(paths.dest.images));
});

function sass() {
   return gulp.src(paths.src.sass)
      .pipe(gulpif(env === "production", sourcemaps.init()))
      .pipe(gsass().on("error", notifyError))
      .pipe(concat(paths.dest.sass.file))
      .pipe(gulpif(env === "production", cleanCSS({
         debug: "true",
         compatibility: "ie9",
         advanced: false // disables any advanced / potentially dangerous optimizations
      }, function(details) {
         console.log(details.name + " efficiency: " + details.stats.efficiency);

         if (details.warnings.length > 0) {
            console.warn(details.name, "\n", details.warnings.join("\n"));
         }

         if (details.errors.length > 0) {
            console.error(details.name, "\n", details.errors.join("\n"));
         }
      })))
      .pipe(gulpif(env === "production", sourcemaps.write("./")))
      .pipe(gulp.dest(paths.dest.sass.path));
}

/**
 * pre-compiles all nunjucks templates and merges it with the
 * nunjucks-slim bundle. since nunjucks ignores UMD module exports,
 * the final js file cannot be bundled by browserify and we need a workaround:
 * generate a second js with all templates in global scope and include it
 * in the index.html before the primary application js.
 */
function compileTemplates(){
   const precompiledTemplates = gulp.src(paths.src.templates)
       .pipe(nunjucks.precompile())
       .on("error", notifyError);

   const nunjucksSlim = gulp.src(paths.src.nunjucksSlim);
   return merge(nunjucksSlim, precompiledTemplates)
       .pipe(concat("templates.js"))
       .pipe(gulpif(env === "production", uglify()))
       .pipe(gulp.dest(paths.dest.templates));
}

/**
 * linting for JavaScript sources
 */
function lint() {
   return gulp.src("./src/js/**.js")
      .pipe(jshint({
         esversion: 6
      }))
      .pipe(jshint.reporter("jshint-stylish"));
};

/**
 * get a new browserify module bundler for javascript modules.
 * before bundling everything together, we transform ES6 input files to
 * widely supported ES5 javascript with babel / babelify.
 */
function getBrowserify() {
   return browserify({
      entries: paths.src.script,
      debug: true,
      extensions: [".js"]
   })
   .require(paths.config, {"expose": "config"})
   .transform(babelify.configure({
      presets: ["es2015"]
   }));
}

/**
 * a helper function to bundle the given resources.
 * @param bundler a watchify or browserify instance
 */
function bundle(bundler) {
   return bundler.bundle()
      .on("error", function(error) {
         notifyError(error);
         this.emit("end");
      })
      .pipe(source('build.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(gulpif(env === "production", uglify()))
      .pipe(sourcemaps.write("./"))
      .pipe(gulp.dest(paths.dest.script));
}

/**
 * compiles the javascript sources with browserify
 */
function compile() {
   return bundle(getBrowserify());
}

/**
 * compiles the javascript sources and keeps watching changes
 * with watchify, which is a wrapper around browserfiy
 */
function compileAndWatch() {
   const wtf = watchify(getBrowserify())
      .on("update", function(ids) {
         lint();
         console.log("Watchify changes:", ids.join(", "));
         bundle(wtf);
      }).on("log", function(message) {
         console.log("Watchify completed:", message);
      });

   return bundle(wtf);
}

/**
 * gzip static assets
 */
function compress() {
   return gulp.src(paths.compress.src)
      .pipe(gzip().on("error", notifyError))
      .pipe(gulp.dest(paths.compress.dest))
}

// define tasks for the different transformation functions
gulp.task("clean", function() { return clean() });
gulp.task("sass", function() { return sass() });
gulp.task("templates", function() { return compileTemplates() });
gulp.task("compile", function() { return compile() });
gulp.task("lint", function() { return lint() });
gulp.task("compress", function() { return compress() });

// the file change watchers & watchify
gulp.task("watch", function() {
   gulp.watch(paths.watch.sass, ["sass"]).on("error", notifyError).on("change", logger);
   gulp.watch(paths.watch.templates, ["templates"]).on("error", notifyError).on("change", logger);
   return compileAndWatch();
});

// the two main tasks: production bundles + compresses, default starts the watchdogs
gulp.task("production", gulpsync.sync(["env:production", "clean", ["copy:images", "sass", "compile"], "compress"]));
gulp.task("default", gulpsync.sync(["env:development", "clean", ["copy:images", "sass", "compile", "templates"], "watch"]));