const tseslint = require('typescript-eslint');
const packageJsonDepsPlugin = require('eslint-plugin-package-json-dependencies');
// The root bun catalog owns the version of every package it names. A workspace
// references those as "catalog:", which is not a semver range this rule can pin, so
// they are excluded here and `scripts/check-deps.ts` is what enforces the reference.
const catalogPackages = Object.keys(require('../../package.json').catalog ?? {});
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
          excludePatterns: ['@sonora/*', ...catalogPackages],
        },
      ],
    },
  },
  // Non-src files (configs, scripts) without type-aware linting
  {
    files: ['**/*.{js,ts}'],
    ignores: ['src/**'],
    extends: [...tseslint.configs.recommended],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Apply TS recommended rules + type-aware linting to src files
  {
    files: ['src/**/*.{js,ts}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'warn',
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
