import { Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getAppVersion } from '@/utils/app-version';

export function AppVersionText() {
  if (Platform.OS !== 'web') return null;

  return (
    <ThemedText themeColor="textSecondary" className="text-xs text-center pb-8 mt-auto">
      {getAppVersion().formatted}
    </ThemedText>
  );
}
