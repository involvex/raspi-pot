#!/usr/bin/env node

/**
 * ESLint Runner Script
 * Runs ESLint with the new flat config format
 */

const { ESLint } = require('eslint');

async function runESLint() {
  try {
    const eslint = new ESLint({
      overrideConfigFile: 'eslint.config.js',
      cache: true,
      cacheLocation: '.eslintcache',
    });

    const results = await eslint.lintFiles(['.']);

    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);

    console.log(resultText);

    // Exit with error code if there are linting errors
    const errorCount = results.reduce((count, result) => count + result.errorCount, 0);
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('ESLint error:', error.message);
    process.exit(1);
  }
}

runESLint();
