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
        files: ['**/experiences.tsx', '**/track-detail-view.tsx', '**/track-map.tsx'],
        rules: [
          'react-compiler',
          'react-doctor/react-compiler',
          'prefer-useReducer',
          'react-doctor/prefer-useReducer',
          'set-state-in-effect',
          'react-doctor/set-state-in-effect',
        ],
        // try/finally in async data-fetching functions is correct error-handling
        // and a known React Compiler limitation (BuildHIR::lowerStatement TryStatement).
        // set-state-in-effect: data fetching via useEffect is the established pattern here.
        // These components use independent loading/error/data state by design.
      },
    ],
  },
} satisfies ReactDoctorConfig;
