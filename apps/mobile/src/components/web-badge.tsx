import { version } from 'expo/package.json';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from './themed-text';
import { TwView } from '@/tw';
import { TwImage } from '@/tw/image';

import { EXPO_BADGE, EXPO_BADGE_WHITE } from '@/constants/images';

export function WebBadge() {
  const { isDark } = useColorScheme();

  return (
    <TwView className="items-center gap-2 p-8">
      <ThemedText type="code" themeColor="textSecondary" className="text-center">
        {'v'}
        {version}
      </ThemedText>
      <TwImage
        source={isDark ? EXPO_BADGE_WHITE : EXPO_BADGE}
        className="w-[123px] aspect-[123/24]"
        alt=""
      />
    </TwView>
  );
}
