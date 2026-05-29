import { useColorScheme } from 'react-native';
import { RuntimeColors } from '@/constants/theme';

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? RuntimeColors.dark : RuntimeColors.light;
}
