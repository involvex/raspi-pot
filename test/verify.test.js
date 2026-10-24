'use strict';

/**
 * Project verification tests (run with `node --test`).
 *
 * These are fast, offline, structural checks that guard the invariants the
 * dashboard relies on: the pages exist, every page exposes the Pi-hole entry
 * point, the Pi-hole client keeps its public API, and the tooling stays wired
 * up. No network access, no running server.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file));

test('the core files of the dashboard exist', () => {
  const required = [
    'server/index.js',
    'server/pihole.js',
    'server/pihole-proxy.js',
    'public/index.html',
    'public/pihole.html',
    'public/terminal.html',
    'public/js/app.js',
    'public/js/pihole.js',
    'ecosystem.config.js',
    '.env.example',
  ];

  for (const file of required) {
    assert.ok(exists(file), `missing ${file}`);
  }
});

test('every dashboard page links to the Pi-hole UI', () => {
  const pages = fs
    .readdirSync(PUBLIC)
    .filter(name => name.endsWith('.html'))
    .filter(name => name !== 'login.html' && name !== 'pihole.html');

  assert.ok(pages.length >= 10, `expected the full page set, found ${pages.length}`);

  for (const page of pages) {
    const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
    assert.match(html, /href="\/pihole\.html"/, `${page} has no Pi-hole navigation link`);
  }
});

test('the Pi-hole page is a self-contained admin UI', () => {
  const html = read('public/pihole.html');

  assert.match(html, /src="js\/app\.js"/, 'app.js (auth + socket) is not loaded');
  assert.match(html, /src="js\/pihole\.js"/, 'pihole.js is not loaded');
  assert.ok(
    html.indexOf('js/app.js') < html.indexOf('js/pihole.js'),
    'pihole.js must load after app.js so that socket/token exist'
  );
  assert.match(html, /socket\.io\/socket\.io\.js/, 'socket.io client is not loaded');
  assert.match(html, /data-tab="dashboard"/, 'the tab bar is missing');
  assert.match(html, /id="adminFrame"/, 'the official-admin fallback frame is missing');
});

test('the Pi-hole client keeps its public API', () => {
  const { PiholeClient, PiholeError, pihole } = require('../server/pihole.js');

  assert.equal(typeof PiholeClient, 'function');
  assert.equal(typeof PiholeError, 'function');
  assert.ok(pihole instanceof PiholeClient, 'a shared client instance is exported');

  const expected = [
    'getVersion',
    'getSummary',
    'getHistory',
    'getQueries',
    'getBlocking',
    'setBlocking',
    'getDomains',
    'addDomain',
    'deleteDomain',
    'getLists',
    'addList',
    'deleteList',
    'getGroups',
    'addGroup',
    'deleteGroup',
    'getConfig',
    'patchConfig',
    'runAction',
    'getLogs',
    'getDhcpLeases',
    'getNetworkDevices',
    'getTeleporter',
  ];

  for (const method of expected) {
    assert.equal(typeof pihole[method], 'function', `pihole.${method}() is missing`);
  }
});

test('the Pi-hole client normalises its base url', () => {
  const { PiholeClient, PiholeError } = require('../server/pihole.js');

  const client = new PiholeClient({ baseUrl: 'http://pihole.local:80///' });

  assert.equal(client.baseUrl, 'http://pihole.local:80');
  assert.equal(client.sid, null);
  assert.equal(client.csrf, null);
  assert.equal(new PiholeError('boom').status, 502);
});

test('package.json keeps the verification scripts wired up', () => {
  const pkg = JSON.parse(read('package.json'));
  const scripts = pkg.scripts || {};

  for (const name of ['lint', 'check', 'test', 'smoke', 'doctor', 'verify']) {
    assert.equal(typeof scripts[name], 'string', `npm run ${name} is missing`);
  }

  assert.equal(pkg.scripts.lint, 'eslint .');
});

test('eslint ignores third-party bundles', () => {
  const config = require('../eslint.config.js');
  const ignores = config.flatMap(entry => entry.ignores || []);

  assert.ok(ignores.includes('public/vendor/**'), 'vendor bundles would be linted');
  assert.ok(ignores.includes('archive/**'), 'archived code would be linted');
});

test('pm2 runs the same entry point we verify', () => {
  const config = read('ecosystem.config.js');

  assert.match(config, /server[\\/]index\.js/);
});

// --- Pi-hole client against a mock FTL -------------------------------------

/**
 * Minimal Pi-hole v6 API stand-in: /api/auth hands out a SID, everything else
 * requires it in the X-FTL-SID header. Mirrors the contract documented at
 * https://docs.pi-hole.net/api/auth/ so the client can be tested offline.
 */
function startMockFtl({ password = 'secret' } = {}) {
  const http = require('http');
  const state = { sid: null, logins: 0, expireNext: false };

  const server = http.createServer((req, res) => {
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };

    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      if (req.method === 'POST' && req.url === '/api/auth') {
        let parsed = {};
        try {
          parsed = JSON.parse(body || '{}');
        } catch (e) {
          return send(400, { error: { key: 'bad_request', message: 'Bad request' } });
        }

        if (parsed.password !== password) {
          return send(401, { error: { key: 'unauthorized', message: 'Unauthorized', hint: null } });
        }

        state.logins += 1;
        state.sid = `sid-${state.logins}`;
        return send(200, {
          session: { valid: true, totp: false, sid: state.sid, csrf: 'csrf-token', validity: 300 },
          took: 0.1,
        });
      }

      if (req.url.startsWith('/api/info/version')) {
        if (req.headers['x-ftl-sid'] !== state.sid) {
          return send(401, { error: { key: 'unauthorized', message: 'Unauthorized' } });
        }
        if (state.expireNext) {
          state.expireNext = false;
          state.sid = 'rotated';
          return send(401, { error: { key: 'unauthorized', message: 'Session expired' } });
        }
        return send(200, { version: { core: { local: { version: 'v6.4.3' } } }, took: 0.1 });
      }

      send(404, { error: { key: 'not_found', message: 'Not found' } });
    });
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        state,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

test('the Pi-hole client logs in and reuses its session', async () => {
  const { PiholeClient } = require('../server/pihole.js');
  const mock = await startMockFtl();

  try {
    const client = new PiholeClient({ baseUrl: mock.baseUrl, password: 'secret', timeout: 5000 });

    const version = await client.getVersion();
    assert.equal(version.version.core.local.version, 'v6.4.3');
    assert.equal(client.sid, 'sid-1');
    assert.equal(mock.state.logins, 1, 'the second request must reuse the SID');
  } finally {
    await mock.close();
  }
});

test('the Pi-hole client re-authenticates once on session expiry', async () => {
  const { PiholeClient } = require('../server/pihole.js');
  const mock = await startMockFtl();

  try {
    const client = new PiholeClient({ baseUrl: mock.baseUrl, password: 'secret', timeout: 5000 });

    await client.getVersion();
    mock.state.expireNext = true;

    const version = await client.getVersion();
    assert.equal(version.version.core.local.version, 'v6.4.3');
    assert.equal(mock.state.logins, 2, 'expected exactly one re-login');
  } finally {
    await mock.close();
  }
});

test('the Pi-hole client surfaces a rejected password', async () => {
  const { PiholeClient, describeError } = require('../server/pihole.js');
  const mock = await startMockFtl();

  try {
    const client = new PiholeClient({ baseUrl: mock.baseUrl, password: 'wrong', timeout: 5000 });

    await assert.rejects(client.getVersion(), err => {
      assert.equal(err.status, 401);
      assert.equal(err.message, 'Unauthorized');

      const described = describeError(err);
      assert.match(described.hint, /PIHOLE_APP_PASSWORD/);
      return true;
    });
  } finally {
    await mock.close();
  }
});

test('connection failures name every address that was tried', async () => {
  const { PiholeClient, describeError } = require('../server/pihole.js');
  const client = new PiholeClient({ baseUrl: 'http://127.0.0.1:1', password: 'x', timeout: 2000 });

  await assert.rejects(client.getVersion(), err => {
    assert.match(err.message, /Cannot reach Pi-hole at http:\/\/127\.0\.0\.1:1/);
    assert.match(err.message, /tried 127\.0\.0\.1:1/);
    assert.match(err.message, /ECONNREFUSED/);
    assert.equal(err.code, 'ECONNREFUSED');
    assert.match(describeError(err).hint, /8080/);
    return true;
  });
});

test('the client prefers IPv4 when a hostname has both address families', async () => {
  const { PiholeClient } = require('../server/pihole.js');
  const client = new PiholeClient({ baseUrl: 'http://localhost', password: 'x' });

  const targets = await client._targets('localhost');
  assert.ok(targets.length > 0, 'localhost must resolve to at least one address');
  assert.equal(targets[0].family, 4, 'IPv4 must be tried first (FTL binds IPv4)');
});

test('a localhost URL still reaches an IPv4-only server', async () => {
  const { PiholeClient } = require('../server/pihole.js');
  // The mock listens on 127.0.0.1 only, while "localhost" may resolve to ::1
  // first - the client must fall back instead of reporting unreachable.
  const mock = await startMockFtl();

  try {
    const port = new URL(mock.baseUrl).port;
    const client = new PiholeClient({
      baseUrl: `http://localhost:${port}`,
      password: 'secret',
      timeout: 5000,
    });

    const version = await client.getVersion();
    assert.equal(version.version.core.local.version, 'v6.4.3');
  } finally {
    await mock.close();
  }
});

test('describeError never returns an empty message', () => {
  const { describeError } = require('../server/pihole.js');

  const empty = describeError(undefined);
  assert.ok(empty.message.length > 0, 'a bare rejection must still produce text');

  const bare = describeError({});
  assert.ok(bare.message.length > 0, 'a non-Error must still produce text');

  const nameless = describeError(
    Object.assign(new Error('unknown error'), { code: 'ECONNREFUSED' })
  );
  assert.equal(nameless.message, 'Network error (ECONNREFUSED)');
  assert.equal(nameless.code, 'ECONNREFUSED');

  const httpError = describeError(Object.assign(new Error('unknown error'), { status: 500 }));
  assert.equal(httpError.message, 'Pi-hole API error (HTTP 500)');
});
