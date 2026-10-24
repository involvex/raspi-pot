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

  for (const name of ['lint', 'check', 'test', 'smoke', 'verify']) {
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
