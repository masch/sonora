const tseslint = require('typescript-eslint');
const packageJsonDepsPlugin = require('eslint-plugin-package-json-dependencies');
const jsoncParser = require('jsonc-eslint-parser');

module.exports = tseslint.config(
  {
    files: ['**/package.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      'package-json-dependencies': packageJsonDepsPlugin,
    },
    rules: {
      'package-json-dependencies/controlled-versions': [
        'error',
        {
          granularity: 'fixed',
          excludePatterns: ['@sonora/*'],
        },
      ],
    },
  },
  // Apply TS recommended rules only to JS/TS files
  {
    files: ['**/*.{js,ts}'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
    },
  },
  {
    files: ['src/scripts/**', 'scripts/**', 'src/server.local.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/*', '.wrangler/*', 'coverage/*'],
  },
);
