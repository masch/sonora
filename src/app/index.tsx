import { Trans } from 'react-i18next';
import { useAppTranslation } from '@/i18n/use-translation';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { WebBadge } from '@/components/web-badge';
import { TwView, TwText } from '@/tw';
import { MaxContentWidth } from '@/constants/theme';

// Horizontal padding matching the card border-radius rhythm (24px)
const SCREEN_HORIZONTAL_PADDING = 24;
// Vertical gap between hero section and the "get started" card
const SECTION_GAP = 16;

export default function HomeScreen() {
  const { t } = useAppTranslation();

  const getDevMenuHint = () => {
    if (Platform.OS === 'web') {
      return <ThemedText type="small">{t('index.hints.devtoolsWeb')}</ThemedText>;
    }
    if (Device.isDevice) {
      return (
        <ThemedText type="small">
          <Trans i18nKey="index.hints.devtoolsDevice" components={[<ThemedText key="code" type="code" />]} />
        </ThemedText>
      );
    }
    return (
      <ThemedText type="small">
        <Trans
          i18nKey={Platform.OS === 'android' ? 'index.hints.devtoolsAndroid' : 'index.hints.devtoolsIos'}
          components={[<ThemedText key="code" type="code" />]}
        />
      </ThemedText>
    );
  };

  return (
    <ScreenWrapper className="justify-center flex-row">
      <TwView
        style={{
          flex: 1,
          paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
          alignItems: 'center',
          gap: SECTION_GAP,
          maxWidth: MaxContentWidth,
        }}>
        <TwView className="items-center justify-center flex-1 px-6 gap-6">
          <AnimatedIcon />
          <TwText className="text-3xl font-bold text-center">
            {t('index.title')}
          </TwText>
        </TwView>

        <ThemedText type="code" className="uppercase">
          {t('index.getStarted')}
        </ThemedText>

        <TwView className="bg-backgroundElement gap-4 self-stretch px-4 py-6 rounded-[24px]">
          <HintRow
            title={t('index.hints.editing')}
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title={t('index.hints.devtools')} hint={getDevMenuHint()} />
          <HintRow
            title={t('index.hints.freshStart')}
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </TwView>

        {Platform.OS === 'web' && <WebBadge />}
      </TwView>
    </ScreenWrapper>
  );
}
