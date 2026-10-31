import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.gz': 'application/gzip', '.wav': 'audio/wav', '.png': 'image/png', '.svg': 'image/svg+xml' };
const requestedPort = Number(process.env.PORT) || 4173;

const handleRequest = (req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  const target = path.resolve(root, '.' + (urlPath === '/' ? '/index.html' : urlPath));
  if (!target.startsWith(root + path.sep) && target !== path.join(root, 'index.html')) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
};

function listen(port, attempts = 0) {
  if (attempts >= 20) throw new Error(`No hay puertos libres entre ${requestedPort} y ${requestedPort + 19}. Cierra una instancia o define PORT.`);
  const server = http.createServer(handleRequest);
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const next = port + 1;
      console.warn(`El puerto ${port} ya está ocupado; pruebo ${next}.`);
      listen(next, attempts + 1);
      return;
    }
    console.error(`No se pudo iniciar el servidor en el puerto ${port}:`, err.message);
    process.exitCode = 1;
  });
  server.listen(port, () => console.log(`Drift Rush: http://localhost:${port}`));
}

listen(requestedPort);
