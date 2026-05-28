import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Platform, useColorScheme } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { WebBadge } from '@/components/web-badge';
import { TwView, TwText, TwPressable } from '@/tw';
import { RuntimeColors } from '@/constants/theme';

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const webContainerClass = Platform.select({ web: 'pt-16 pb-6' }) ?? '';

export default function TabTwoScreen() {
  const scheme = useColorScheme();
  const colors = RuntimeColors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <ScrollScreenWrapper
      contentContainerClassName={`flex-row justify-center ${webContainerClass}`.trim()}>
      <TwView className="max-w-[800px] flex-grow">
        <TwView className="gap-4 items-center px-6 py-16">
          <TwText className="text-3xl font-bold">Explore</TwText>
          <ThemedText className="text-center" themeColor="textSecondary">
            This starter app includes example{'\n'}code to help you get started.
          </ThemedText>

          <ExternalLink href="https://docs.expo.dev" asChild>
            <TwPressable className="active:opacity-70">
              <TwView className="bg-backgroundElement flex-row px-6 py-2 rounded-[32px] justify-center gap-1 items-center">
                <ThemedText type="link">Expo documentation</ThemedText>
                <SymbolView
                  tintColor={colors.text}
                  name={{ ios: 'arrow.up.right.square', android: 'link', web: 'link' }}
                  size={12}
                />
              </TwView>
            </TwPressable>
          </ExternalLink>
        </TwView>

        <TwView className="gap-8 px-6 pt-4">
          <Collapsible title="File-based routing">
            <ThemedText type="small">
              This app has two screens: <ThemedText type="code">src/app/index.tsx</ThemedText> and{' '}
              <ThemedText type="code">src/app/explore.tsx</ThemedText>
            </ThemedText>
            <ThemedText type="small">
              The layout file in <ThemedText type="code">src/app/_layout.tsx</ThemedText> sets up
              the tab navigator.
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/router/introduction">
              <ThemedText type="linkPrimary">Learn more</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title="Android, iOS, and web support">
            <TwView className="bg-backgroundElement items-center">
              <ThemedText type="small">
                You can open this project on Android, iOS, and the web. To open the web version,
                press <ThemedText type="smallBold">w</ThemedText> in the terminal running this
                project.
              </ThemedText>
              <Image
                source={require('@/assets/images/tutorial-web.png')}
                style={{ width: '100%', aspectRatio: 296 / 171, borderRadius: 16, marginTop: 8 }}
              />
            </TwView>
          </Collapsible>

          <Collapsible title="Images">
            <ThemedText type="small">
              For static images, you can use the <ThemedText type="code">@2x</ThemedText> and{' '}
              <ThemedText type="code">@3x</ThemedText> suffixes to provide files for different
              screen densities.
            </ThemedText>
            <Image
              source={require('@/assets/images/react-logo.png')}
              style={{ width: 100, height: 100, alignSelf: 'center' }}
            />
            <ExternalLink href="https://reactnative.dev/docs/images">
              <ThemedText type="linkPrimary">Learn more</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title="Light and dark mode components">
            <ThemedText type="small">
              This template has light and dark mode support. The{' '}
              <ThemedText type="code">useColorScheme()</ThemedText> hook lets you inspect what the
              user&apos;s current color scheme is, and so you can adjust UI colors accordingly.
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
              <ThemedText type="linkPrimary">Learn more</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title="Animations">
            <ThemedText type="small">
              This template includes an example of an animated component. The{' '}
              <ThemedText type="code">src/components/ui/collapsible.tsx</ThemedText> component uses
              the powerful <ThemedText type="code">react-native-reanimated</ThemedText> library to
              animate opening this hint.
            </ThemedText>
          </Collapsible>
        </TwView>
        {Platform.OS === 'web' && <WebBadge />}
      </TwView>
    </ScrollScreenWrapper>
  );
}
