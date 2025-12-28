import url from 'url';
import fs from 'fs';
import crypto from 'crypto';
import chalk from 'chalk';

import path from 'canonical-path';

const checksums = {};

const plugin = (opts = {}) => {
  const pattern = /url\((['"])?([^'")]+)(['"])?\)/g;
  let supportedProps = [
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
  supportedProps = opts.supportedProps || supportedProps;
  supportedProps = supportedProps.concat(opts.additionalProps || []);

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

  function resolveUrl(assetUrl, file, imagesPath) {
    let assetPath = decodeURI(assetUrl.pathname);

    if (/^\//.test(assetUrl.pathname)) {
      assetPath = path.join(imagesPath, assetPath);
    } else {
      assetPath = path.join(opts.cssPath || path.dirname(file), assetPath);
    }
    return assetPath;
  }

  function updateAssetUrl(assetUrl, inputFile) {
    const assetPath = resolveUrl(assetUrl, inputFile, opts.imagesPath);

    // complete url with cachebuster
    const cachebuster = createCachebuster(assetPath, assetUrl.pathname, opts.type);
    if (!cachebuster) {
      return;
    } else if (typeof opts.type === 'function') {
      assetUrl.pathname = cachebuster;
    } else if (assetUrl.search && assetUrl.search.length > 1) {
      assetUrl.search = assetUrl.search + '&' + opts.paramName + cachebuster;
    } else {
      assetUrl.search = '?' + opts.paramName + cachebuster;
    }
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

        const assetUrl = url.parse(originalUrl);
        updateAssetUrl(assetUrl, inputFile);

        atrule.params = 'url(' + quote + url.format(assetUrl) + quote + ')';
      });

      root.walkDecls(function walkThroughtDeclarations(declaration) {
        // only image and font related declarations
        if (supportedProps.indexOf(declaration.prop) === -1) {
          return;
        }

        declaration.value = declaration.value.replace(pattern, function (match, quote, originalUrl) {
          quote = quote || '"';

          const assetUrl = url.parse(originalUrl);

          // only locals
          if (
            assetUrl.host ||
            assetUrl.pathname.indexOf('//') === 0 ||
            assetUrl.pathname.indexOf(';base64') !== -1
          ) {
            return match;
          }

          updateAssetUrl(assetUrl, inputFile);

          return 'url(' + quote + url.format(assetUrl) + quote + ')';
        });
      });
    },
  };
};

plugin.postcss = true;

export default plugin;
