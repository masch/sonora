import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 *
 * Uses useSyncExternalStore to detect client hydration without triggering
 * react-hooks/set-state-in-effect (the useState + useEffect pattern was
 * rejected by Expo's ESLint rules).
 */
export function useColorScheme() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const colorScheme = useRNColorScheme();

  if (isClient) {
    return colorScheme;
  }

  return 'light';
}
