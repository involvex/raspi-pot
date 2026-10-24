#!/usr/bin/env node

/**
 * End-to-end smoke test.
 *
 * Boots the real server on a throw-away port with a self-contained
 * environment, then exercises the auth, Pi-hole and static-file surface
 * over HTTP. The Pi-hole admin proxy is disabled so nothing collides with
 * a running production instance.
 *
 *   node scripts/smoke-server.js
 *
 * Exits 0 when every check passes, 1 otherwise.
 */

const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SMOKE_PORT || 3999);
const PASSWORD = 'smoke-test-password';
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PASSWORD }),
      });
      if (res.ok) return true;
    } catch (error) {
      // Not listening yet.
    }
    await sleep(250);
  }
  return false;
}

async function run() {
  const server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      ADMIN_PASSWORD: PASSWORD,
      JWT_SECRET: 'smoke-test-secret',
      PIHOLE_ENABLE_PROXY: 'false',
      PIHOLE_URL: 'http://127.0.0.1:1',
      PIHOLE_APP_PASSWORD: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  server.stdout.on('data', chunk => (output += chunk));
  server.stderr.on('data', chunk => (output += chunk));

  try {
    if (!(await waitForServer())) {
      record('server boots and answers POST /api/login', false, 'timed out');
      console.error(output.trim());
      return 1;
    }
    record('server boots and answers POST /api/login', true);

    const login = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const { token } = await login.json();
    record('login returns a JWT', Boolean(token));

    const badLogin = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    record('login rejects a wrong password', badLogin.status === 401, `status ${badLogin.status}`);

    const auth = { Authorization: `Bearer ${token}` };

    const health = await fetch(`${BASE}/api/health`, { headers: auth });
    record('GET /api/health returns 200', health.status === 200, `status ${health.status}`);

    const status = await fetch(`${BASE}/api/pihole/status`, { headers: auth });
    const body = await status.json();
    record('GET /api/pihole/status returns 200', status.status === 200, `status ${status.status}`);
    record('Pi-hole status reports reachability', typeof body.reachable === 'boolean');
    record('admin proxy can be disabled by env', body.adminProxy?.enabled === false);

    const unauthenticated = await fetch(`${BASE}/api/pihole/status`);
    record(
      'GET /api/pihole/status rejects unauthenticated calls',
      unauthenticated.status === 401,
      `status ${unauthenticated.status}`
    );

    for (const page of ['/index.html', '/pihole.html', '/terminal.html']) {
      const res = await fetch(`${BASE}${page}`);
      const html = res.status === 200 ? await res.text() : '';
      record(`GET ${page} serves the page`, html.includes('<html'), `status ${res.status}`);
    }

    return results.every(result => result.ok) ? 0 : 1;
  } catch (error) {
    console.error('Smoke test aborted:', error.message);
    return 1;
  } finally {
    server.kill();
  }
}

run().then(code => {
  const failed = results.filter(result => !result.ok).length;
  console.log(`\nSmoke test: ${results.length - failed}/${results.length} checks passed.`);
  process.exit(code);
});
