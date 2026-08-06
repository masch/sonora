import type { TabListProps } from 'expo-router/ui';

import { TwView } from '@/tw';
import { useThemeColors } from '@/hooks/use-theme-colors';

export function CustomTabList({
  children,
  style,
  testID = 'custom-tab-list',
}: TabListProps & { testID?: string }) {
  const colors = useThemeColors();
  return (
    <TwView
      testID={testID}
      className="absolute bottom-0 w-full p-4 justify-center items-center flex-row z-50"
    >
      <TwView
        style={[style, { backgroundColor: colors.tabBarBg }]}
        className="py-2 px-8 rounded-[32px] flex-row items-center justify-center gap-2 self-start"
      >
        {children}
      </TwView>
    </TwView>
  );
}
