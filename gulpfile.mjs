import gulp from 'gulp';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const files = ['index.mjs', 'test/*.mjs', 'gulpfile.mjs'];
const mochaBin = fileURLToPath(new URL('./node_modules/mocha/bin/mocha.js', import.meta.url));

export function test() {
  return new Promise((resolve, reject) => {
    const mocha = spawn(process.execPath, [mochaBin, 'test/*.mjs'], {
      stdio: 'inherit',
    });

    mocha.on('error', reject);
    mocha.on('close', function (code) {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Mocha exited with code ${code}`));
    });
  });
}

export function watch() {
  return gulp.watch(files, gulp.series(test));
}

gulp.task('test', test);
gulp.task('watch', gulp.series(test, watch));
gulp.task('default', gulp.series(test));
