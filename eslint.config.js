const js = require('@eslint/js');
const globals = require('globals');

/**
 * ESLint owns *correctness* (unused code, undefined references, unsound
 * control flow, ...). Formatting is owned by Prettier (.prettierrc); the
 * two used to fight over quotes, trailing commas, indentation and the
 * spacing of `async (…) =>`, so every stylistic rule now lives in Prettier
 * only. Run `npm run format` / `npm run format:check` for style.
 */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'client/build/**',
      'client/.svelte-kit/**',
      'client/dist/**',
      'plugins/**',
      'archive/**',
      'logs/**',
      'test/**',
      'coverage/**',
      '.nyc_output/**',
      'uploads/**',
      'test-uploads/**',
      '.eslintcache',
      // Third-party bundles that ship as-is (xterm, addons, ...).
      'public/vendor/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'log', 'info', 'debug'],
        },
      ],
    },
  },
  {
    // Classic browser scripts.
    files: ['public/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        io: 'readonly',
      },
    },
  },
  {
    // pihole.js consumes the `socket`/`token` created by app.js.
    files: ['public/js/pihole.js'],
    languageOptions: {
      globals: {
        socket: 'readonly',
        token: 'readonly',
      },
    },
  },
];
