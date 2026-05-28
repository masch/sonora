import { version } from 'expo/package.json';
import { Image } from 'expo-image';
import { useColorScheme } from 'react-native';

import { ThemedText } from './themed-text';
import { TwView } from '@/tw';

export function WebBadge() {
  const scheme = useColorScheme();

  return (
    <TwView className="items-center gap-2 p-8">
      <ThemedText type="code" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {'v'}{version}
      </ThemedText>
      <Image
        source={
          scheme === 'dark'
            ? require('@/assets/images/expo-badge-white.png')
            : require('@/assets/images/expo-badge.png')
        }
        style={{ width: 123, aspectRatio: 123 / 24 }}
      />
    </TwView>
  );
}
