# Design: Remediate Bracket Notation Vulnerabilities

## Technical Solutions

### Theme Indexing (explore.tsx, collapsible.tsx, app-tabs.tsx)
- Replaced dynamic dictionary lookups with a unified React hook `useThemeColors` (`src/hooks/use-theme-colors.ts`):
  ```typescript
  import { useColorScheme } from 'react-native';
  import { RuntimeColors } from '@/constants/theme';

  export function useThemeColors() {
    const scheme = useColorScheme();
    return scheme === 'dark' ? RuntimeColors.dark : RuntimeColors.light;
  }
  ```
- Consuming components retrieve colors cleanly with:
  ```typescript
  const colors = useThemeColors();
  ```

### Map Indexing (themed-text.tsx)
- Guarded prop checks using `hasOwnProperty`:
  ```typescript
  const typeClass = Object.prototype.hasOwnProperty.call(typeClassMap, type)
    ? typeClassMap[type]
    : typeClassMap.default;
  ```
