// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18nextPlugin = require('eslint-plugin-i18next');
const packageJsonDepsPlugin = require('eslint-plugin-package-json-dependencies');
const jsoncParser = require('jsonc-eslint-parser');

/**
 * Imports this app refuses everywhere, each one naming the reason and the
 * alternative. Kept as data so a rule that has to relax a single entry can
 * re-declare the rest instead of switching the whole guard off.
 */
const RESTRICTED_IMPORTS = [
  {
    name: 'react-native',
    importNames: ['Modal'],
    message:
      'Use BottomModal (for sheet modals) or ModalPrimitive (for fullscreen/custom dialogs) instead of raw React Native Modal.',
  },
  {
    name: 'react-native',
    importNames: ['Button', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback'],
    message:
      'Use <Button> from "@/components/ui/button" instead of React Native button/touchable primitives.',
  },
  {
    name: '@/tw',
    importNames: ['TwButton'],
    message: 'Use <Button> from "@/components/ui/button" instead of TwButton.',
  },
];

/**
 * Refused everywhere except the one map that still uses it; see the exception
 * below. A pattern rather than a path, so a subpath import such as
 * `leaflet/dist/leaflet-src` is refused too.
 *
 * This rule sees static import declarations only: it does not follow `require()`
 * or a dynamic `import()`. The source test in
 * `src/__tests__/leaflet-deprecation.test.ts` covers those, and the CDN script a
 * WebView loads, which never passes through an import at all.
 */
const LEAFLET_DEPRECATION = {
  group: ['leaflet', 'leaflet/*'],
  message:
    'Leaflet is deprecated and frozen: it keeps working as it is and gets no new features. Build against the MapLibre renderer (src/components/map/experience-map.tsx) instead.',
};

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
          excludePatterns: ['@sonora/*'],
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
          project: './tsconfig.json',
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
          // No allow list needed — all exceptions are handled by
          // inline eslint-disable comments in specific source lines.
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: RESTRICTED_IMPORTS,
          patterns: [LEAFLET_DEPRECATION],
        },
      ],
    },
  },
  {
    files: ['**/src/components/ui/modal-primitive.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // The one surviving Leaflet map, frozen on purpose: the deprecation guard
    // above is what keeps it the only one. It relaxes that one entry and keeps
    // the rest of the guard, which has nothing to do with Leaflet.
    files: ['**/src/components/track-detail-map.web.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: RESTRICTED_IMPORTS }],
    },
  },
  {
    files: ['**/__tests__/**'],
    rules: {
      'i18next/no-literal-string': 'off',
      'import/first': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
