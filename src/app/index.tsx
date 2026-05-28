import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { TwView, TwText } from '@/tw';
import { BottomTabInset, TabBottomPadding, MaxContentWidth } from '@/constants/theme';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

// Horizontal padding matching the card border-radius rhythm (24px)
const SCREEN_HORIZONTAL_PADDING = 24;
// Vertical gap between hero section and the "get started" card
const SECTION_GAP = 16;

export default function HomeScreen() {
  return (
    <ScreenWrapper className="justify-center flex-row">
      <SafeAreaView
        style={{
          flex: 1,
          paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
          alignItems: 'center',
          gap: SECTION_GAP,
          paddingBottom: BottomTabInset + TabBottomPadding,
          maxWidth: MaxContentWidth,
        }}>
        <TwView className="items-center justify-center flex-1 px-6 gap-6">
          <AnimatedIcon />
          <TwText className="text-3xl font-bold text-center">
            Welcome to&nbsp;Expo
          </TwText>
        </TwView>

        <ThemedText type="code" className="uppercase">
          get started
        </ThemedText>

        <TwView className="bg-backgroundElement gap-4 self-stretch px-4 py-6 rounded-[24px]">
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </TwView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ScreenWrapper>
  );
}
