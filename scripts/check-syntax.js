#!/usr/bin/env node

/**
 * Static verification pass.
 *
 *   - Parses every hand-written JavaScript file with `node --check`.
 *   - Parses every JSON file (package.json, .mcp.json, configs, ...).
 *
 * Third-party bundles, archived code and generated output are skipped.
 * Exits 0 when everything parses, 1 otherwise.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'archive',
  'client',
  'dist',
  'build',
  'logs',
  'coverage',
  '.nyc_output',
  'uploads',
  'test-uploads',
]);

const SKIP_PREFIXES = [path.join(ROOT, 'public', 'vendor')];

const JS_PATTERN = /\.(?:js|mjs|cjs)$/;
const JSON_PATTERN = /\.json$/;

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function isVendorPath(target) {
  return SKIP_PREFIXES.some(prefix => target === prefix || target.startsWith(prefix + path.sep));
}

function walk(dir, files = []) {
  if (isVendorPath(dir)) return files;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return files;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || isVendorPath(full)) continue;
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function checkScript(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status === 0) return null;
  const output = (result.stderr || result.stdout || 'unknown syntax error').trim();
  return output.split('\n').slice(0, 3).join(' ').trim();
}

function checkJson(file) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    return null;
  } catch (error) {
    return error.message;
  }
}

function main() {
  const files = walk(ROOT);
  const scripts = files.filter(file => JS_PATTERN.test(file));
  const jsonFiles = files.filter(file => JSON_PATTERN.test(file));

  const failures = [];

  for (const file of scripts) {
    const error = checkScript(file);
    if (error) failures.push({ file: rel(file), error });
  }

  for (const file of jsonFiles) {
    const error = checkJson(file);
    if (error) failures.push({ file: rel(file), error });
  }

  console.log(
    `Syntax check: ${scripts.length} JS, ${jsonFiles.length} JSON (${failures.length} failing)`
  );

  if (failures.length > 0) {
    console.error('');
    for (const failure of failures) {
      console.error(`  ${failure.file}`);
      console.error(`    ${failure.error}`);
    }
    process.exit(1);
  }
}

main();
