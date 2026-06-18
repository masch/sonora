import { version } from 'expo/package.json';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from './themed-text';
import { TwView } from '@/tw';
import { TwImage } from '@/tw/image';

const expoBadgeWhite = require('@/assets/images/expo-badge-white.png');
const expoBadge = require('@/assets/images/expo-badge.png');

export function WebBadge() {
  const { isDark } = useColorScheme();

  return (
    <TwView className="items-center gap-2 p-8">
      <ThemedText type="code" themeColor="textSecondary" className="text-center">
        {'v'}
        {version}
      </ThemedText>
      <TwImage
        source={isDark ? expoBadgeWhite : expoBadge}
        className="w-[123px] aspect-[123/24]"
        alt=""
      />
    </TwView>
  );
}
