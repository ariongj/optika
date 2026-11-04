// Bake-only static server: the page, the bundle, the sources and an upload endpoint for results.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const assets = path.join(root, 'assets');
const site = path.join(root, '..', '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.hdr': 'application/octet-stream', '.gltf': 'application/json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && url.startsWith('/save/')) {
    const file = path.join(root, 'out', path.basename(url));
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(file, Buffer.concat(chunks));
      res.end('ok');
    });
    return;
  }
  let file;
  if (url === '/') file = path.join(root, 'page.html');
  else if (url.startsWith('/assets/')) file = path.join(assets, url.slice(8));
  else if (url.startsWith('/fonts/')) file = path.join(site, 'node_modules', url.slice(7));
  else file = path.join(root, url);
  fs.readFile(file, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('nf');
      return;
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(4400, () => console.log('bake server on 4400'));
