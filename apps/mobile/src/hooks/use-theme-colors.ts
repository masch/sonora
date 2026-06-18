import { useColorScheme } from './use-color-scheme';
import { RuntimeColors } from '@/constants/theme';

export function useThemeColors() {
  const { isDark } = useColorScheme();
  return isDark ? RuntimeColors.dark : RuntimeColors.light;
}
