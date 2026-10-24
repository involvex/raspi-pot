#!/usr/bin/env node

/**
 * Pi-hole connectivity doctor.
 *
 *   npm run doctor
 *
 * When the dashboard says "Pi-hole unreachable", this narrows it down to one
 * of five causes: URL, DNS, TCP, HTTP, or the password/session. It runs the
 * same client the server uses, plus raw per-address probes.
 */

require('dotenv').config();

const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const { PiholeClient, describeError } = require('../server/pihole.js');

const BASE_URL = (process.env.PIHOLE_URL || 'http://127.0.0.1').replace(/\/+$/, '');
const PASSWORD = process.env.PIHOLE_APP_PASSWORD || process.env.PIHOLE_PASSWORD || '';
const VERIFY_TLS = String(process.env.PIHOLE_VERIFY_TLS || 'true').toLowerCase() !== 'false';
const TIMEOUT = Number(process.env.PIHOLE_TIMEOUT || 8000);

let failures = 0;

function pass(label, detail = '') {
  console.log(`  PASS  ${label}${detail ? ` - ${detail}` : ''}`);
}

function fail(label, detail = '') {
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? ` - ${detail}` : ''}`);
}

function warn(label, detail = '') {
  console.log(`  WARN  ${label}${detail ? ` - ${detail}` : ''}`);
}

function info(label, detail = '') {
  console.log(`  info  ${label}${detail ? ` - ${detail}` : ''}`);
}

function stripBrackets(hostname) {
  return hostname.replace(/^\[/, '').replace(/\]$/, '');
}

function tcpProbe(address, port, timeout = 3000) {
  return new Promise(resolve => {
    const started = Date.now();
    const socket = net.connect({ host: address, port });

    const finish = (ok, detail) => {
      socket.destroy();
      resolve({ ok, ms: Date.now() - started, detail });
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true, 'connected'));
    socket.once('timeout', () => finish(false, `timed out after ${timeout} ms`));
    socket.once('error', err => finish(false, err.code || err.message));
  });
}

/** Minimal request helper that mirrors the server's TLS settings. */
function request(url, options = {}) {
  const method = options.method || 'GET';
  const body = options.body === undefined ? null : JSON.stringify(options.body);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: stripBrackets(url.hostname),
        port: Number(url.port) || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        rejectUnauthorized: isHttps ? VERIFY_TLS : undefined,
        timeout: TIMEOUT,
      },
      res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            data = text;
          }
          resolve({ status: res.statusCode, data, contentType: res.headers['content-type'] || '' });
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error(`timed out after ${TIMEOUT} ms`)));
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\nPi-hole doctor\n==============\n');

  console.log('Configuration');
  info('PIHOLE_URL', BASE_URL);
  info('PIHOLE_APP_PASSWORD', PASSWORD ? `set (${PASSWORD.length} characters)` : 'EMPTY');
  info('PIHOLE_VERIFY_TLS', String(VERIFY_TLS));
  info('timeout', `${TIMEOUT} ms`);

  let url;
  try {
    url = new URL(BASE_URL);
  } catch (e) {
    fail('PIHOLE_URL is a valid URL', BASE_URL);
    return;
  }

  const host = stripBrackets(url.hostname);
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
  pass('PIHOLE_URL parses', `${url.protocol}//${url.host}`);

  if (url.protocol === 'https:' && !VERIFY_TLS) {
    warn(
      'TLS verification is disabled',
      'set PIHOLE_VERIFY_TLS=true once the certificate is trusted'
    );
  }

  if (host === 'localhost') {
    warn(
      'PIHOLE_URL uses "localhost"',
      'Node may resolve it to ::1 while Pi-hole binds IPv4 - http://127.0.0.1 is safer'
    );
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    warn('PIHOLE_URL has a path', `RaspiPot appends /api/... to "${url.pathname}"`);
  }

  console.log('\nDNS');
  let addresses;
  const literal = net.isIP(host);
  if (literal) {
    addresses = [{ address: host, family: literal }];
    info('host is an IP literal', host);
  } else {
    try {
      addresses = await dns.promises.lookup(host, { all: true });
      pass('hostname resolves', addresses.map(a => `${a.address} (v${a.family})`).join(', '));
    } catch (err) {
      fail('hostname resolves', `${err.code || ''} ${err.message}`.trim());
      return;
    }
  }

  console.log('\nTCP');
  let anyOpen = false;
  for (const entry of addresses) {
    const result = await tcpProbe(entry.address, port);
    if (result.ok) {
      anyOpen = true;
      pass(`connect ${entry.address}:${port}`, `${result.ms} ms`);
    } else {
      fail(`connect ${entry.address}:${port}`, result.detail);
    }
  }

  if (!anyOpen) {
    const alternative = port === 80 ? 8080 : null;
    if (alternative) {
      const alt = addresses[0];
      const result = await tcpProbe(alt.address, alternative);
      if (result.ok) {
        console.log(
          `\n  hint: port ${alternative} is open on ${alt.address} - Pi-hole v6 moves there when lighttpd still owns :80`
        );
        console.log(`        try PIHOLE_URL=http://${host}:${alternative}`);
      }
    }
    return;
  }

  console.log('\nHTTP API');
  try {
    const res = await request(new URL(`${BASE_URL}/api/info/version`));
    const contentType = res.contentType;
    if (contentType.includes('application/json')) {
      pass('GET /api/info/version', `HTTP ${res.status}`);
      if (res.status === 200 && res.data) {
        const version = res.data.version || res.data;
        info('reported version', JSON.stringify(version).slice(0, 200));
      }
    } else {
      fail(
        'GET /api/info/version',
        `HTTP ${res.status} with ${contentType || 'no content-type'} - this is not the Pi-hole API`
      );
      console.log(
        '  hint: PIHOLE_URL must point at the Pi-hole web root, not the old admin or a proxy'
      );
      return;
    }
  } catch (err) {
    const described = describeError(err);
    fail('GET /api/info/version', described.message);
    if (described.hint) console.log(`  hint: ${described.hint}`);
    return;
  }

  console.log('\nAuthentication');
  if (!PASSWORD) {
    warn(
      'PIHOLE_APP_PASSWORD is empty',
      'expected only if Pi-hole has no password; otherwise run "pihole setpassword"'
    );
  }

  const client = new PiholeClient({
    baseUrl: BASE_URL,
    password: PASSWORD,
    verifyTls: VERIFY_TLS,
    timeout: TIMEOUT,
  });

  try {
    const version = await client.getVersion();
    pass('authenticated request (GET /api/info/version via client)');
    info('client sees', JSON.stringify(version).slice(0, 200));

    try {
      const blocking = await client.getBlocking();
      pass(
        'session is usable (GET /api/dns/blocking)',
        `blocking=${JSON.stringify(blocking.blocking)}`
      );
    } catch (err) {
      const described = describeError(err);
      fail('session is usable (GET /api/dns/blocking)', described.message);
      if (described.hint) console.log(`  hint: ${described.hint}`);
    }

    await client.logout();
    info('session closed', 'freed the Pi-hole API slot');
  } catch (err) {
    const described = describeError(err);
    fail('authenticated request', described.message);
    if (described.code) console.log(`  code: ${described.code}`);
    if (described.hint) console.log(`  hint: ${described.hint}`);

    if (err && err.detail && typeof err.detail === 'object') {
      info('Pi-hole said', JSON.stringify(err.detail).slice(0, 300));
    }
  }
}

main()
  .catch(err => {
    failures += 1;
    console.error('\nDoctor crashed:', err && err.stack ? err.stack : err);
  })
  .finally(() => {
    console.log('');
    if (failures === 0) {
      console.log('Result: Pi-hole is reachable and the configured password authenticates.');
      process.exit(0);
    }
    console.log(`Result: ${failures} check(s) failed - see the hints above.`);
    process.exit(1);
  });
