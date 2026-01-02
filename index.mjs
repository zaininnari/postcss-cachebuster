import fs from 'fs';
import crypto from 'crypto';
import chalk from 'chalk';

import path from 'canonical-path';

const checksums = {};

/**
 * parsed
 * @typedef {Object} parsed
 * @property {URL} u
 * @property {boolean} isAbsolute
 * @property {boolean} isRootRelativeButNotProtocolRelative
 * @property {string} originalUrl
 */

const plugin = (opts = {}) => {
  const pattern = /url\((['"])?([^'")]+)(['"])?\)/g;
  const supportedPropsDefault = [
    'background',
    'background-image',
    'border-image',
    'behavior',
    'src'
  ];

  opts.imagesPath = opts.imagesPath ? process.cwd() + opts.imagesPath : process.cwd();
  opts.cssPath = opts.cssPath ? process.cwd() + opts.cssPath : false;
  opts.type = opts.type || 'mtime';
  opts.paramName = opts.paramName || 'v';
  opts.hashAlgorithm = opts.hashAlgorithm || 'md5';
  opts.supportedProps = opts.supportedProps || supportedPropsDefault;
  opts.additionalProps = opts.additionalProps || [];
  const supportedProps = opts.supportedProps.concat(opts.additionalProps);

  function createCachebuster(assetPath, origPath, type) {
    let cachebuster;

    if (typeof type === 'function') {
      cachebuster = type(assetPath, origPath);
    } else if (!fs.existsSync(assetPath)) {
      console.log('Cachebuster:', chalk.yellow('file unreachable or not exists', assetPath));
    } else if (type === 'checksum') {
      // Used to distinguish between different hash algorithms among the
      // remembered checksum values in the `checksums` array.
      const checksumKey = [assetPath, opts.hashAlgorithm].join('|');

      if (checksums[checksumKey]) {
        cachebuster = checksums[checksumKey];
      } else {
        const data = fs.readFileSync(assetPath);
        cachebuster = crypto.createHash(opts.hashAlgorithm)
          .update(data)
          .digest('hex');

        checksums[checksumKey] = cachebuster;
      }
    } else {
      const mtime = fs.statSync(assetPath).mtime;
      cachebuster = mtime.getTime().toString(16);
    }

    return cachebuster;
  }

  /**
   * @param assetUrl {URL}
   * @param file {string}
   * @param imagesPath {string}
   * @param isRootRelativeButNotProtocolRelative {boolean}
   * @returns {string}
   */
  function resolveUrl(assetUrl, file, imagesPath, isRootRelativeButNotProtocolRelative) {
    let assetPath = decodeURI(assetUrl.pathname);

    if (isRootRelativeButNotProtocolRelative) {
      assetPath = path.join(imagesPath, assetPath);
    } else {
      assetPath = path.join(opts.cssPath || path.dirname(file), assetPath);
    }
    return assetPath;
  }

  /**
   * @param assetUrl {URL}
   * @param inputFile {string}
   * @param isRootRelativeButNotProtocolRelative {boolean}
   */
  function updateAssetUrl(assetUrl, inputFile, isRootRelativeButNotProtocolRelative) {
    const assetPath = resolveUrl(assetUrl, inputFile, opts.imagesPath, isRootRelativeButNotProtocolRelative);

    // complete url with cachebuster
    const originPath = isRootRelativeButNotProtocolRelative ? assetUrl.pathname : assetUrl.pathname.substring(1);
    const cachebuster = createCachebuster(assetPath, originPath, opts.type);
    if (!cachebuster) {
      return;
    }

    if (typeof opts.type === 'function') {
      assetUrl.pathname = cachebuster;
    } else if (assetUrl.search && assetUrl.search.length > 1) {
      assetUrl.search = assetUrl.search + '&' + opts.paramName + cachebuster;
    } else {
      assetUrl.search = '?' + opts.paramName + cachebuster;
    }
  }

  const DUMMY_BASE = 'http://localhost';

  /**
   * @param input {string}
   * @returns {parsed}
   */
  function parseUrlPreserveRelative(input) {
    const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(input);
    const isRootRelativeButNotProtocolRelative = /^\/(?!\/)/.test(input);
    const u = isAbsolute ? new URL(input) : new URL(input, DUMMY_BASE);
    return {u, isAbsolute, isRootRelativeButNotProtocolRelative, originalUrl: input};
  }

  /**
   * @param parsed {parsed}
   * @returns {string|string}
   */
  function formatUrlPreserveRelative(parsed) {
    const u = parsed.u;
    const isAbsolute = parsed.isAbsolute;
    const isRootRelativeButNotProtocolRelative = parsed.isRootRelativeButNotProtocolRelative;

    if (isAbsolute) {
      return u.toString();
    }
    const url = `${u.pathname}${u.search}${u.hash}`;
    if (!isRootRelativeButNotProtocolRelative) {
      // remove start slash
      return  url.substring(1);
    }
    return url;
  }

  return {
    postcssPlugin: 'postcss-cachebuster',
    Once(root) {
      const inputFile = opts.cssPath || root.source?.input?.file || '';

      root.walkAtRules('import', function walkThroughtImports(atrule) {
        pattern.lastIndex = 0;
        const results = pattern.exec(atrule.params);
        if (!results) return;

        const quote = results[1] || '"';
        const originalUrl = results[2];

        const parsed = parseUrlPreserveRelative(originalUrl);
        updateAssetUrl(parsed.u, inputFile, parsed.isRootRelativeButNotProtocolRelative, parsed.originalUrl);

        atrule.params = 'url(' + quote + formatUrlPreserveRelative(parsed) + quote + ')';
      });

      root.walkDecls(function walkThroughtDeclarations(declaration) {
        // only image and font related declarations
        if (supportedProps.indexOf(declaration.prop) === -1) {
          return;
        }

        declaration.value = declaration.value.replace(pattern, function (match, quote, originalUrl) {
          quote = quote || '"';

          const parsed = parseUrlPreserveRelative(originalUrl);
          const assetUrl = parsed.u;

          // only locals
          if (
            assetUrl.toString().indexOf(DUMMY_BASE) !== 0 ||
            parsed.isAbsolute ||
            assetUrl.pathname.indexOf('//') === 0 ||
            assetUrl.pathname.indexOf(';base64') !== -1
          ) {
            return match;
          }

          updateAssetUrl(assetUrl, inputFile, parsed.isRootRelativeButNotProtocolRelative);

          return 'url(' + quote + formatUrlPreserveRelative(parsed) + quote + ')';
        });
      });
    },
  };
};

plugin.postcss = true;

export default plugin;
