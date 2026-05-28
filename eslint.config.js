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
          allow: [
            // className and testID are not user-facing
            'className',
            'testID',
            // NativeWind/Expo classnames and Tailwind values
            'text-',
            'font-',
            'bg-',
            'p-',
            'm-',
            'gap-',
            'flex-',
            'items-',
            'justify-',
            'self-',
            'rounded-',
            'w-',
            'h-',
            'max-w-',
            'tracking-',
            'uppercase',
            'text-center',
            'opacity-',
            'active:',
            'dark:',
            // Platform.select values and runtime constants
            'pt-16 pb-6',
            // Single-character or short labels that are non-translatable
            'JD',
            // Route names and technical identifiers
            'index',
            'explore',
            'settings',
            // Technical file paths and commands used as HintRow hints
            'src/app/index.tsx',
            'npm run reset-project',
            // Single-char prefixes like v{version} in web badge
            'v{version}',
            'v',
          ],
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
