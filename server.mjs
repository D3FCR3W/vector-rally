import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('./public/', import.meta.url);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 4173);
const handleRequest = async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || relative.split('/').includes('..')) {
      res.writeHead(403).end('Forbidden'); return;
    }
    const file = new URL(relative, root);
    if (!file.href.startsWith(root.href)) { res.writeHead(403).end('Forbidden'); return; }
    const data = await readFile(fileURLToPath(file));
    const ext = relative.slice(relative.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': `${types[ext] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
};

// localhost may resolve to either loopback family. Serve both without exposing
// the development server to other devices on the network.
const hosts = ['127.0.0.1', '::1'];
const servers = hosts.map(() => createServer(handleRequest));
let ready = 0;
for (const [index, server] of servers.entries()) {
  server.on('error', error => {
    console.error(`Cannot listen on ${hosts[index]}:${port}: ${error.message}`);
    process.exitCode = 1;
    for (const listener of servers) listener.close();
  });
  server.listen({ port, host: hosts[index], ipv6Only: true }, () => {
    if (++ready === servers.length) {
      console.log(`Vector Rally is ready at http://localhost:${port}`);
      console.log(`IPv4: http://127.0.0.1:${port}`);
    }
  });
}
