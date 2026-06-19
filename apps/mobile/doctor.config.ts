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
        files: ['**/tracks.tsx', 'src/app/(tabs)/tracks.tsx'],
        rules: [
          'rn-no-inline-flatlist-renderitem',
          'rn-list-callback-per-row',
          'react-doctor/rn-no-inline-flatlist-renderitem',
          'react-doctor/rn-list-callback-per-row',
        ],
        // Ignore FlatList inline renderItem warning for horizontal category selector since it has small static items
      },
    ],
  },
} satisfies ReactDoctorConfig;
