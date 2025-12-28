'use strict';

const gulp = require('gulp');
const mocha = require('gulp-mocha');

const files = ['index.js', 'test/*.js', 'gulpfile.js'];

function test() {
  return gulp.src('test/*.js', { read: false }).pipe(mocha());
}

function watch() {
  return gulp.watch(files, gulp.series(test));
}

exports.test = test;
exports.watch = gulp.series(test, watch);
exports.default = gulp.series(test);
