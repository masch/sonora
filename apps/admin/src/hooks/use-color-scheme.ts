import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme() {
  const scheme = useRNColorScheme() ?? 'light';
  return {
    scheme,
    isDark: scheme === 'dark',
  };
}
