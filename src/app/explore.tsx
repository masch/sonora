import { Trans } from 'react-i18next';
import { useAppTranslation } from '@/hooks/use-translation';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Platform } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { WebBadge } from '@/components/web-badge';
import { TwView, TwText, TwPressable } from '@/tw';
import { useThemeColors } from '@/hooks/use-theme-colors';

const tutorialWebImg = require('@/assets/images/tutorial-web.png');
const reactLogoImg = require('@/assets/images/react-logo.png');

// Web: fixed padding below the horizontal tab bar via Tailwind spacing
const webContainerClass = Platform.select({ web: 'pt-16 pb-6' }) ?? '';

export default function TabTwoScreen() {
  const colors = useThemeColors();
  const { t } = useAppTranslation();

  return (
    <ScrollScreenWrapper
      contentContainerClassName={`flex-row justify-center ${webContainerClass}`.trim()}
    >
      <TwView className="max-w-[800px] flex-grow">
        <TwView className="gap-4 items-center px-6 py-16">
          <TwText className="text-3xl font-bold">{t('explore.title')}</TwText>
          <ThemedText className="text-center" themeColor="textSecondary">
            {t('explore.subtitle')}
          </ThemedText>

          <ExternalLink href="https://docs.expo.dev" asChild>
            <TwPressable className="active:opacity-70">
              <TwView className="bg-backgroundElement flex-row px-6 py-2 rounded-[32px] justify-center gap-1 items-center">
                <ThemedText type="link">{t('explore.docLink')}</ThemedText>
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
          <Collapsible title={t('explore.sections.fileRouting.title')}>
            <ThemedText type="small">
              <Trans
                i18nKey="explore.sections.fileRouting.desc"
                components={[<ThemedText key="code" type="code" />]}
              />
            </ThemedText>
            <ThemedText type="small">
              <Trans
                i18nKey="explore.sections.fileRouting.layout"
                components={[<ThemedText key="code" type="code" />]}
              />
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/router/introduction">
              <ThemedText type="linkPrimary">{t('common.learnMore')}</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={t('explore.sections.platforms.title')}>
            <TwView className="bg-backgroundElement items-center">
              <ThemedText type="small">
                <Trans
                  i18nKey="explore.sections.platforms.desc"
                  components={{ bold: <ThemedText type="smallBold" /> }}
                />
              </ThemedText>
              <Image
                source={tutorialWebImg}
                style={{ width: '100%', aspectRatio: 296 / 171, borderRadius: 16, marginTop: 8 }}
              />
            </TwView>
          </Collapsible>

          <Collapsible title={t('explore.sections.images.title')}>
            <ThemedText type="small">
              <Trans
                i18nKey="explore.sections.images.desc"
                components={[<ThemedText key="code" type="code" />]}
              />
            </ThemedText>
            <Image source={reactLogoImg} style={{ width: 100, height: 100, alignSelf: 'center' }} />
            <ExternalLink href="https://reactnative.dev/docs/images">
              <ThemedText type="linkPrimary">{t('common.learnMore')}</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={t('explore.sections.theme.title')}>
            <ThemedText type="small">
              <Trans
                i18nKey="explore.sections.theme.desc"
                components={[<ThemedText key="code" type="code" />]}
              />
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
              <ThemedText type="linkPrimary">{t('common.learnMore')}</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={t('explore.sections.animations.title')}>
            <ThemedText type="small">
              <Trans
                i18nKey="explore.sections.animations.desc"
                components={[<ThemedText key="code" type="code" />]}
              />
            </ThemedText>
          </Collapsible>
        </TwView>
        {Platform.OS === 'web' && <WebBadge />}
      </TwView>
    </ScrollScreenWrapper>
  );
}
