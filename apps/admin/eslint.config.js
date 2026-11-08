// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18nextPlugin = require('eslint-plugin-i18next');
const packageJsonDepsPlugin = require('eslint-plugin-package-json-dependencies');
// The root bun catalog owns the version of every package it names. A workspace
// references those as "catalog:", which is not a semver range this rule can pin, so
// they are excluded here and `scripts/check-deps.ts` is what enforces the reference.
const catalogPackages = Object.keys(require('../../package.json').catalog ?? {});
const jsoncParser = require('jsonc-eslint-parser');

module.exports = defineConfig([
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
  expoConfig,
  {
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: 'apps/admin/tsconfig.json',
        },
      },
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { i18next: i18nextPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
      'i18next/no-literal-string': [
        'error',
        {
          markupOnly: true,
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**'],
    rules: {
      'i18next/no-literal-string': 'off',
      'import/first': 'off',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
