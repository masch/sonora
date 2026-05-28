// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18nextPlugin = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  {
    plugins: { i18next: i18nextPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
      'i18next/no-literal-string': [
        'error',
        {
          markupOnly: true,
          // No allow list needed — all exceptions are handled by
          // inline eslint-disable comments in specific source lines.
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**'],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
