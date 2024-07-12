import type { ReactDoctorConfig } from 'react-doctor/api';

export default {
  ignore: {
    overrides: [
      {
        files: ['src/app/_layout.tsx'],
        rules: ['deslop/unused-file'],
        // Expo Router loads _layout.tsx by convention — not an unused file. deslop doesn't understand file-based routing.
      },
      {
        files: ['**/experiences.tsx'],
        rules: [
          'rn-no-inline-flatlist-renderitem',
          'rn-list-callback-per-row',
          'react-doctor/rn-no-inline-flatlist-renderitem',
          'react-doctor/rn-list-callback-per-row',
        ],
        // Ignore FlatList inline renderItem warning for horizontal category selector since it has small static items
      },
      {
        files: ['package.json'],
        rules: [
          'deslop/unused-dependency',
          'react-doctor/expo-lockfile',
          'react-doctor/deslop/unused-dependency',
        ],
      },
      {
        files: [
          '**/experiences.tsx',
          '**/explore.tsx',
          '**/track-detail-view.tsx',
          '**/trip-detail-view.tsx',
          '**/track-map.tsx',
        ],
        rules: [
          'react-compiler',
          'react-doctor/react-compiler',
          'prefer-useReducer',
          'react-doctor/prefer-useReducer',
          'set-state-in-effect',
          'react-doctor/set-state-in-effect',
          'no-initialize-state',
          'react-doctor/no-initialize-state',
          'no-giant-component',
          'react-doctor/no-giant-component',
        ],
        // try/finally in async data-fetching functions is correct error-handling
        // and a known React Compiler limitation (BuildHIR::lowerStatement TryStatement).
        // set-state-in-effect: data fetching via useEffect is the established pattern here.
        // These components use independent loading/error/data state by design.
      },
      {
        files: [
          'src/storage/config-cache.ts',
          'src/storage/config-cache.web.ts',
          'src/storage/translation-cache.ts',
          'src/storage/translation-cache.web.ts',
        ],
        rules: ['deslop/unused-export', 'react-doctor/deslop/unused-export'],
        // Platform-split files (web vs native) are dynamically resolved by Metro and appear unused in static analysis.
      },
      {
        files: ['src/store/download-manager-store.ts'],
        rules: ['async-await-in-loop', 'react-doctor/async-await-in-loop'],
        // Sequential reading from stream reader chunks requires await in a loop.
      },
      {
        files: ['src/hooks/use-track-download.ts', 'src/hooks/use-immersion-player.ts'],
        rules: [
          'no-fetch-in-effect',
          'react-doctor/no-fetch-in-effect',
          'no-event-handler',
          'react-doctor/no-event-handler',
        ],
        // Custom background ETag fetching and audio player synchronization with external subscriptions.
      },
      {
        files: ['src/hooks/use-purchase.ts'],
        rules: [
          'no-effect-with-fresh-deps',
          'react-doctor/no-effect-with-fresh-deps',
          'exhaustive-deps',
          'react-doctor/exhaustive-deps',
          'react-compiler-no-manual-memoization',
          'react-doctor/react-compiler-no-manual-memoization',
        ],
        // Hooks are optimized by React Compiler; static analysis flags hook functions in dependency arrays as fresh.
        // We use useCallback to satisfy standard React/ESLint exhaustive-deps without using eslint-disable comments.
      },
      {
        files: ['dist/**'],
        rules: ['artifact-baas-authority-surface', 'react-doctor/artifact-baas-authority-surface'],
        // Ignore static build artifacts.
      },
    ],
  },
} satisfies ReactDoctorConfig;
