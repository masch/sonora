import { Trans } from 'react-i18next';
import { useAppTranslation } from '@/hooks/use-translation';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ScrollScreenWrapper, ScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { TwView, TwText } from '@/tw';
import { MaxContentWidth } from '@/constants/theme';

// Horizontal padding matching the card border-radius rhythm (24px)
const SCREEN_HORIZONTAL_PADDING = 24;
// Vertical gap between hero section and the "get started" card
const SECTION_GAP = 16;
// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const CONTENT_PADDING = 'pt-16 pb-6';

// Technical constants (paths & commands) excluded from translation lists
const HINT_FILE_PATH = 'src/app/index.tsx';
const RESET_PROJECT_COMMAND = 'npm run reset-project';

export default function HomeScreen() {
  const { t } = useAppTranslation();

  const getDevMenuHint = () => {
    if (Platform.OS === 'web') {
      return <ThemedText type="small">{t('index.hints.devtoolsWeb')}</ThemedText>;
    }
    if (Device.isDevice) {
      return (
        <ThemedText type="small">
          <Trans
            i18nKey="index.hints.devtoolsDevice"
            components={[<ThemedText key="code" type="code" />]}
          />
        </ThemedText>
      );
    }
    return (
      <ThemedText type="small">
        <Trans
          i18nKey={
            Platform.OS === 'android' ? 'index.hints.devtoolsAndroid' : 'index.hints.devtoolsIos'
          }
          components={[<ThemedText key="code" type="code" />]}
        />
      </ThemedText>
    );
  };

  const innerView = (
    <TwView
      style={{
        width: '100%',
        maxWidth: MaxContentWidth,
        paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
        alignItems: 'center',
        gap: SECTION_GAP,
      }}
      className="self-center"
    >
      <TwView className="items-center justify-center px-6 gap-6 py-16">
        <AnimatedIcon />
        <TwText className="text-3xl font-bold text-center">{t('index.title')}</TwText>
      </TwView>

      <ThemedText type="code" className="uppercase">
        {t('index.getStarted')}
      </ThemedText>

      <TwView className="bg-backgroundElement gap-6 self-stretch p-4 rounded-[24px]">
        <HintRow
          title={t('index.hints.editing')}
          hint={<ThemedText type="code">{HINT_FILE_PATH}</ThemedText>}
        />
        <HintRow title={t('index.hints.devtools')} hint={getDevMenuHint()} />
        <HintRow
          title={t('index.hints.freshStart')}
          hint={<ThemedText type="code">{RESET_PROJECT_COMMAND}</ThemedText>}
        />
      </TwView>

      {Platform.OS === 'web' && <WebBadge />}
    </TwView>
  );

  if (Platform.OS === 'web') {
    return (
      <ScreenWrapper>
        <TwView className={CONTENT_PADDING} style={{ flex: 1 }}>
          {innerView}
        </TwView>
      </ScreenWrapper>
    );
  }

  return (
    <ScrollScreenWrapper contentContainerClassName={CONTENT_PADDING}>
      {innerView}
    </ScrollScreenWrapper>
  );
}
