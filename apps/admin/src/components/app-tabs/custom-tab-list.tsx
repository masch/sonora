import type { TabListProps } from 'expo-router/ui';

import { TwView } from '@/tw';
import { useThemeColors } from '@/hooks/use-theme-colors';

export function CustomTabList({ children, style }: TabListProps) {
  const colors = useThemeColors();
  return (
    <TwView
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 p-4 justify-center items-center flex-row z-50"
    >
      <TwView
        style={[style, { backgroundColor: colors.tabBarBg }]}
        className="py-2 px-8 rounded-[32px] flex-row items-center justify-center gap-2 self-start shadow-sm border border-[#dfd7c8]/20"
      >
        {children}
      </TwView>
    </TwView>
  );
}
