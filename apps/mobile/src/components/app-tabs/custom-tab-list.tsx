import type { TabListProps } from 'expo-router/ui';

import { TwView } from '@/tw';
import { useThemeColors } from '@/hooks/use-theme-colors';

export function CustomTabList({ children, style }: TabListProps) {
  const colors = useThemeColors();
  return (
    <TwView className="absolute w-full p-4 justify-center items-center flex-row">
      <TwView
        style={[style, { backgroundColor: colors.tabBarBg }]}
        className="py-2 px-8 rounded-[32px] flex-row items-center justify-center gap-2 self-start"
      >
        {children}
      </TwView>
    </TwView>
  );
}
