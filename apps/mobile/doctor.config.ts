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
        files: ['src/providers/remote-config-provider.tsx'],
        rules: [
          'react-compiler',
          'react-doctor/react-compiler',
          'react-compiler-no-manual-memoization',
          'react-doctor/react-compiler-no-manual-memoization',
          'exhaustive-deps',
          'react-doctor/exhaustive-deps',
          'rerender-state-only-in-handlers',
          'react-doctor/rerender-state-only-in-handlers',
          'no-react19-deprecated-apis',
          'react-doctor/no-react19-deprecated-apis',
        ],
        // ConfigProvider uses useCallback + async + try/catch for data fetching —
        // all deliberate patterns. The refetchCount useState is the simplest pattern
        // to trigger useEffect re-runs (useRef can't trigger re-renders).
        // useContext → use() is React 19 migration, left for when the project upgrades.
        // useCallback is kept for clarity even though React Compiler would handle it.
      },
      {
        files: ['src/providers/__tests__/remote-config-provider.test.tsx'],
        rules: ['react-compiler', 'react-doctor/react-compiler'],
        // Test file — dynamic hooks inside TestConsumer are intentional for testing context.
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
    ],
  },
} satisfies ReactDoctorConfig;
