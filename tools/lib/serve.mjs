// The tests' shared kit: a static file server and free ports (Node built-ins only).
//   import { serve, freePort, portArg } from './lib/serve.mjs';
//   const srv = await serve(dir, { port: 0, pages: true });   // srv.port, srv.url, await srv.close()
// pages: true serves as GitHub Pages does (ten minutes' browser caching, ETags, 304s), the way tools/live.mjs and
// tools/update.mjs need; without it, as a plain development server (no-cache, ETags, a folder's listing as
// python3 -m http.server gives one), which tools/smoke.mjs and tools/audio.mjs expect. Both answer byte ranges.
// port 0 (the default) takes a free port: two runs on one machine never collide.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.webm': 'video/webm', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv', '.tif': 'image/tiff', '.tiff': 'image/tiff' };

// a free TCP port on host (asked of the system, then let go: the caller listens on it next)
export const freePort = (host = '127.0.0.1') => new Promise((res, rej) => {
  const s = http.createServer();
  s.once('error', rej);
  s.listen(0, host, () => { const { port } = s.address(); s.close(() => res(port)); });
});

// --port <n> from an argument list, or null
export const portArg = (args, flag = '--port') => { const i = args.indexOf(flag); return i >= 0 && /^\d+$/.test(args[i + 1] || '') ? +args[i + 1] : null; };

export function serve(dir, { port = 0, host = '127.0.0.1', pages = false } = {}) {
  const root = path.resolve(dir);
  const srv = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    let f = path.join(root, rel);
    if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.stat(f, (err, st) => {
      if (!err && st.isDirectory()) {
        if (!rel.endsWith('/')) { res.writeHead(301, { Location: rel + '/' }); res.end(); return; }
        const ix = path.join(f, 'index.html');
        if (fs.existsSync(ix)) f = ix;
        else if (!pages) {
          const names = fs.readdirSync(f, { withFileTypes: true }).map(d => d.name + (d.isDirectory() ? '/' : '')).sort();
          const body = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${rel}</title></head><body><ul>${names.map(n => `<li><a href="${encodeURI(n)}">${n}</a></li>`).join('')}</ul></body></html>`;
          res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' }); res.end(body); return;
        } else { res.writeHead(404); res.end(); return; }
      }
      fs.readFile(f, (err2, body) => {
        if (err2) { res.writeHead(404); res.end(); return; }
        const tag = '"' + crypto.createHash('md5').update(body).digest('hex') + '"';
        const h = { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': pages ? 'max-age=600' : 'no-cache', ETag: tag, 'Accept-Ranges': 'bytes' };
        if (req.headers['if-none-match'] === tag) { res.writeHead(304, h); res.end(); return; }
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (m) {
          const s = m[1] ? +m[1] : 0, e = m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
          res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${e}/${body.length}` }); res.end(req.method === 'HEAD' ? undefined : body.subarray(s, e + 1)); return;
        }
        res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : body);
      });
    });
  });
  return new Promise((res, rej) => {
    srv.once('error', rej);
    srv.listen(port, host, () => {
      const p = srv.address().port;
      res({ server: srv, port: p, url: `http://${host}:${p}/`, close: () => { srv.closeAllConnections(); return new Promise(r => srv.close(r)); } });
    });
  });
}
