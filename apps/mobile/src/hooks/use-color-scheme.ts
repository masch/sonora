import { useColorScheme as useRNColorScheme } from 'react-native';

// react-doctor-disable-next-line deslop/unused-export — false positive: re-exported wrapper, used via @/ alias
export function useColorScheme() {
  const scheme = useRNColorScheme() ?? 'light';
  return {
    scheme,
    isDark: scheme === 'dark',
  };
}
