import gulp from 'gulp';
import gulpMocha from 'gulp-mocha';

const files = ['index.mjs', 'test/*.mjs', 'gulpfile.mjs'];

export function test() {
  return gulp.src('test/*.mjs', { read: false }).pipe(gulpMocha());
}

export function watch() {
  return gulp.watch(files, gulp.series(test));
}

// gulp v5 が確実に拾えるよう、タスクとして明示登録
gulp.task('test', test);
gulp.task('watch', gulp.series(test, watch));
gulp.task('default', gulp.series(test));

