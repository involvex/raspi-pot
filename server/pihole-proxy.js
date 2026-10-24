'use strict';

/**
 * Minimal reverse proxy that exposes the official Pi-hole v6 web interface
 * (served by pihole-FTL on PIHOLE_URL, usually port 80) on a second local
 * port. This lets RaspiPot embed the upstream admin UI in an iframe without
 * clashing with its own `/api` routes - the iframe origin is the proxy, so
 * Pi-hole's own absolute `/admin` and `/api` paths resolve untouched.
 *
 * Dependency-free: Node core http/https only. Proxies plain HTTP requests,
 * streaming responses, and WebSocket upgrades.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

function startPiholeProxy(options = {}) {
  const port = Number(options.port || process.env.PIHOLE_ADMIN_PROXY_PORT || 8081);
  const target = new URL(options.target || process.env.PIHOLE_URL || 'http://localhost');
  const isHttps = target.protocol === 'https:';
  const transport = isHttps ? https : http;
  const targetPort = target.port || (isHttps ? 443 : 80);

  const verifyTls =
    String(
      options.verifyTls !== undefined ? options.verifyTls : process.env.PIHOLE_VERIFY_TLS || 'true'
    ).toLowerCase() !== 'false';

  const server = http.createServer((req, res) => {
    const upstream = transport.request(
      {
        hostname: target.hostname,
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: target.host },
        rejectUnauthorized: isHttps ? verifyTls : undefined,
      },
      upRes => {
        res.writeHead(upRes.statusCode, upRes.headers);
        upRes.pipe(res);
      }
    );

    upstream.on('error', err => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      res.end(`Pi-hole proxy error: ${err.message}`);
    });

    req.pipe(upstream);
  });

  // Pass WebSocket upgrades straight through (Pi-hole uses them for live data).
  server.on('upgrade', (req, socket, head) => {
    const upstream = transport.request({
      hostname: target.hostname,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: target.host },
      rejectUnauthorized: isHttps ? verifyTls : undefined,
    });

    upstream.on('upgrade', (upRes, upSocket, upHead) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\n');
      Object.keys(upRes.headers).forEach(key => {
        socket.write(`${key}: ${upRes.headers[key]}\r\n`);
      });
      socket.write('\r\n');
      if (upHead && upHead.length) socket.unshift(upHead);
      upSocket.pipe(socket).pipe(upSocket);
    });

    upstream.on('error', () => socket.destroy());
    if (head && head.length) upstream.write(head);
    upstream.end();
  });

  return new Promise(resolve => {
    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[pihole-proxy] port ${port} already in use - official admin proxy disabled`);
      } else {
        console.warn(`[pihole-proxy] failed to start: ${err.message}`);
      }
      resolve(null);
    });

    server.listen(port, () => {
      console.log(`[pihole-proxy] official Pi-hole admin proxied on :${port} -> ${target.origin}`);
      resolve(server);
    });
  });
}

module.exports = { startPiholeProxy };
