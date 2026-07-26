import postcss from 'postcss';
import path from 'node:path';
import fs from 'fs';
import chalk from 'chalk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import plugin from '../index.mjs';

const assert = async function (input, output, opts, expectations) {
  const result = await postcss([plugin(opts)]).process(input, { from: undefined });
  expect(result.css).toEqual(output);
  expect(result.warnings()).toHaveLength(0);
  if (expectations) {
    expectations();
  }
};

describe('postcss-cachebuster', function () {
  const horseMtime = fs.statSync('./test/files/horse.jpg').mtime.getTime().toString(16);
  const horseWithSpacesMtime = fs.statSync('./test/files/horse with spaces.jpg').mtime.getTime().toString(16);
  const fontMtime = fs.statSync('./test/files/opensansbold.ttf').mtime.getTime().toString(16);
  const htcMtime = fs.statSync('./test/files/backgroundsize.htc').mtime.getTime().toString(16);
  const cssMtime = fs.statSync('./test/css/styles.css').mtime.getTime().toString(16);

  afterEach(function () {
    vi.restoreAllMocks();
  });

  it('Process image, with relative path', async function () {
    await assert(
      'a { background-image : url("files/horse.jpg"); }',
      'a { background-image : url("files/horse.jpg?v' + horseMtime + '"); }',
      { cssPath: '/test/' },
    );
  });

  it('Process image, with absolute path', async function () {
    await assert(
      'a { background-image : url("/files/horse.jpg"); }',
      'a { background-image : url("/files/horse.jpg?v' + horseMtime + '"); }',
      { imagesPath: '/test/' },
    );
  });

  it('Process image, with spaces in name', async function () {
    await assert(
      'a { background-image : url("/files/horse with spaces.jpg"); }',
      'a { background-image : url("/files/horse%20with%20spaces.jpg?v' + horseWithSpacesMtime + '"); }',
      { imagesPath: '/test/' },
    );
  });

  it('Skip base64 images', async function () {
    await assert(
      'a { background-image : url("data:image/png;base64,iVBORw0"); }',
      'a { background-image : url("data:image/png;base64,iVBORw0"); }',
      { imagesPath: '/test/' },
    );
  });

  it('Skip unresolved images', async function () {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(function () {});
    await assert(
      'a { background-image : url("there/is/no/image.jpg"); }',
      'a { background-image : url("there/is/no/image.jpg"); }',
      { imagesPath: '/test/' },
      function () {
        expect(consoleLogSpy).toHaveBeenCalledExactlyOnceWith(
          'Cachebuster:',
          chalk.yellow('file unreachable or not exists', 'there/is/no/image.jpg'),
        );
      },
    );
  });

  it('Process font file', async function () {
    await assert(
      'a { src : url("files/opensansbold.ttf"); }',
      'a { src : url("files/opensansbold.ttf?v' + fontMtime + '"); }',
      { cssPath: '/test/' },
    );
  });

  it('Process .htc file', async function () {
    await assert(
      'a { behavior : url("files/backgroundsize.htc"); }',
      'a { behavior : url("files/backgroundsize.htc?v' + htcMtime + '"); }',
      { cssPath: '/test/' },
    );
  });

  it('Add cachebuster to import css file', async function () {
    await assert('@import url("/css/styles.css");', '@import url("/css/styles.css?v' + cssMtime + '");', {
      imagesPath: '/test/',
    });
  });

  it('Add cachebuster to all imports in the css file', async function () {
    await assert(
      '@import url("/css/styles.css");@import url("/css/styles.css");',
      '@import url("/css/styles.css?v' + cssMtime + '");@import url("/css/styles.css?v' + cssMtime + '");',
      { imagesPath: '/test/' },
    );
  });

  it('Change url with function', async function () {
    await assert(
      'a { background-image : url("files/horse.jpg"); }',
      'a { background-image : url("files/horse.abc123.jpg"); }',
      {
        type: function (assetPath, origPath) {
          expect(assetPath).to.equal(path.join(path.dirname(new URL(import.meta.url).pathname), 'files/horse.jpg'));
          expect(origPath).to.equal('files/horse.jpg');
          return 'files/horse.abc123.jpg';
        },
        cssPath: '/test/',
      },
    );
  });

  it('Change url with default checksum', async function () {
    await assert(
      'a { background-image : url("files/horse.jpg"); }',
      'a { background-image : url("files/horse.jpg?vac17ceac5567ecf01eab7c474b3b8426"); }',
      { type: 'checksum', cssPath: '/test/' },
    );
  });

  it('Change url with checksum using specified hash algorithm', async function () {
    await assert(
      'a { background-image : url("files/horse.jpg"); }',
      'a { background-image : url("files/horse.jpg?v8a88fc3de434b972f5bebdcd33474cc2259310c1"); }',
      { type: 'checksum', hashAlgorithm: 'sha1', cssPath: '/test/' },
    );
  });

  it('Skip unrecognized CSS property', async function () {
    await assert('a { mask-image : url("/files/horse.jpg"); }', 'a { mask-image : url("/files/horse.jpg"); }', {
      imagesPath: '/test/',
    });
  });

  it('Add cachebuster for additional specified CSS property', async function () {
    await assert(
      'a { mask-image : url("/files/horse.jpg"); }',
      'a { mask-image : url("/files/horse.jpg?v' + horseMtime + '"); }',
      { imagesPath: '/test/', additionalProps: ['mask-image'] },
    );
  });
});
