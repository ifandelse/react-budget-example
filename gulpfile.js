var gulp        = require("gulp");
var gutil       = require("gulp-util");
var cleanhtml   = require('gulp-cleanhtml');
var minifyCSS   = require('gulp-minify-css');
var uglify      = require("gulp-uglify");
var htmlreplace = require('gulp-html-replace');
var rename      = require("gulp-rename");
var react       = require('gulp-react');
var express     = require("express");
var path        = require("path");
var open        = require("open");
var livereload  = require('gulp-livereload');
var port        = 3080;

gulp.task('minify-css', function() {
    return gulp.src('src/*.css')
        .pipe(minifyCSS(opts))
        .pipe(rename("main.min.css"))
        .pipe(gulp.dest('dist'));
});

gulp.task('build-jsx', function(){
    return gulp.src('src/*.js')
        .pipe(react())
        .pipe(uglify({ "reservedNames" : "postal,React"}))
        .pipe(rename("main.min.js"))
        .pipe(gulp.dest('dist'));
});

gulp.task('clean-html', function(){
  gulp.src('src/*.html')
    .pipe(htmlreplace({
        'css': 'main.min.css',
        'js' : 'main.min.js'
    }))
    .pipe(cleanhtml())
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', function(){
    var server = livereload();
    gulp.watch('src/*.js', ['build-jsx']);
    gulp.watch('src/*.css', ['minify-css']);
    gulp.watch('src/*.html', ['clean-html']);
    gulp.watch('dist/**').on('change', function(file) {
      server.changed(file.path);
  });
});

var createServer = function(port) {
    var p = path.resolve("./");
    var app = express();
    app.use(express.static(p));
    app.listen(port, function() {
        gutil.log("Listening on", port);
    });

    return {
        app: app
    };
};

gulp.task("server", function(){
    createServer(port);
    open( "http://localhost:" + port + "/dist/index.html" );
});

gulp.task('default', ['minify-css', 'build-jsx', 'clean-html', 'server', 'watch']);