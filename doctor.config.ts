import type { ReactDoctorConfig } from 'react-doctor/api';

export default {
  ignore: {
    overrides: [
      {
        files: ['src/app/_layout.tsx'],
        rules: ['deslop/unused-file'],
        // Expo Router loads _layout.tsx by convention — not an unused file. deslop doesn't understand file-based routing.
      },
    ],
  },
} satisfies ReactDoctorConfig;
