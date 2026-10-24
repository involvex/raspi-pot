#!/usr/bin/env node

/**
 * One-shot verification gate.
 *
 *   npm run verify
 *
 * Runs, in order, and stops reporting a non-zero exit code when any step
 * fails:
 *
 *   1. syntax check of every JS/JSON file   (scripts/check-syntax.js)
 *   2. ESLint                               (scripts/lint.js)
 *   3. Prettier formatting                  (prettier . --check)
 *   4. offline unit tests                   (node --test test/verify.test.js)
 *   5. live HTTP smoke test                 (scripts/smoke-server.js)
 */

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRETTIER = require.resolve('prettier/bin/prettier.cjs');

const STEPS = [
  { name: 'syntax check', args: ['scripts/check-syntax.js'] },
  { name: 'eslint', args: ['scripts/lint.js'] },
  { name: 'formatting', args: [PRETTIER, '.', '--check'] },
  { name: 'unit tests', args: ['--test', 'test/verify.test.js'] },
  { name: 'http smoke test', args: ['scripts/smoke-server.js'] },
];

const summary = [];

for (const step of STEPS) {
  console.log(`\n=== ${step.name} ===`);
  const result = spawnSync(process.execPath, step.args, { cwd: ROOT, stdio: 'inherit' });
  summary.push({ name: step.name, ok: result.status === 0 });
}

console.log('\n=== verification summary ===');
for (const step of summary) {
  console.log(`${step.ok ? 'PASS' : 'FAIL'}  ${step.name}`);
}

const failures = summary.filter(step => !step.ok).length;
process.exit(failures === 0 ? 0 : 1);
