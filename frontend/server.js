const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Strip query strings from URL
function cleanUrl(url) {
  return url.split('?')[0];
}

const server = http.createServer((req, res) => {
  const clean = cleanUrl(req.url);
  let filePath = path.join(DIST, clean === '/' ? 'index.html' : clean);

  const isAsset = clean.startsWith('/assets/');

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Assets have content-hash names → cache forever; HTML → no cache
  const cacheControl = isAsset
    ? 'public, max-age=31536000, immutable'
    : 'no-cache, no-store, must-revalidate';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving on port ${PORT}`);
});
