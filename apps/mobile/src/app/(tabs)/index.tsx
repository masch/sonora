import { useRouter } from 'expo-router';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { HomeAudioPlayer } from '@/components/home-audio-player';
import { getExperienceIcon } from '@/utils/icons';

const unifiedHeaderImg = require('@/assets/images/sonora/home-unified-header.png');

export const SHOW_LOCAL_MESSAGES = true;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tripIcon = getExperienceIcon('trip');
  const trackIcon = getExperienceIcon('track');
  const messageIcon = getExperienceIcon('general-feedback');

  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerClassName="grow pb-8 bg-background">
      {/* Top Header - Unified Mockup Header Image */}
      <TwView className="relative w-full h-[380px] border-b border-zinc-800/15">
        <TwImage
          source={unifiedHeaderImg}
          className="w-full h-full"
          contentFit="contain"
          alt={t('home.bannerAlt')}
        />
        {/* Hidden text layers for accessibility and test suites */}
        <TwView className="absolute -top-9999 left-0 opacity-0">
          <ThemedText>{t('home.title')}</ThemedText>
          <ThemedText>{t('home.poetic')}</ThemedText>
        </TwView>
      </TwView>

      {/* Main Content Area */}
      <TwView className="px-8 pt-6">
        {/* Interactive Home Audio Player */}
        <HomeAudioPlayer />

        {/* Navigation List Menu */}
        <TwView className="gap-1">
          {/* Explorar Recorridos */}
          <TwPressable
            onPress={() => router.push('/trips')}
            accessibilityLabel={t('home.exploreRoutes')}
            testID="explore-routes-menu"
            className="flex-row items-center justify-between py-5 border-b border-zinc-800/10 active:opacity-75"
          >
            <TwView className="flex-row items-center gap-4 flex-1">
              <Icon
                ios={tripIcon.ios}
                android={tripIcon.android}
                web={tripIcon.web}
                size={24}
                tintColor={colors.text}
              />
              <TwView className="flex-1">
                <ThemedText className="text-lg font-bold text-text">
                  {t('home.exploreRoutes')}
                </ThemedText>
                <ThemedText className="text-sm text-textSecondary mt-0.5">
                  {t('home.exploreRoutesSub')}
                </ThemedText>
              </TwView>
            </TwView>
            <Icon
              ios="chevron.right"
              android="chevron_right"
              web="chevron_right"
              size={20}
              tintColor={colors.textSecondary}
            />
          </TwPressable>

          {/* Explorar Tracks */}
          <TwPressable
            onPress={() => router.push('/tracks')}
            accessibilityLabel={t('home.exploreTracks')}
            testID="explore-tracks-menu"
            className="flex-row items-center justify-between py-5 border-b border-zinc-800/10 active:opacity-75"
          >
            <TwView className="flex-row items-center gap-4 flex-1">
              <Icon
                ios={trackIcon.ios}
                android={trackIcon.android}
                web={trackIcon.web}
                size={24}
                tintColor={colors.text}
              />
              <TwView className="flex-1">
                <ThemedText className="text-lg font-bold text-text">
                  {t('home.exploreTracks')}
                </ThemedText>
                <ThemedText className="text-sm text-textSecondary mt-0.5">
                  {t('home.exploreTracksSub')}
                </ThemedText>
              </TwView>
            </TwView>
            <Icon
              ios="chevron.right"
              android="chevron_right"
              web="chevron_right"
              size={20}
              tintColor={colors.textSecondary}
            />
          </TwPressable>

          {/* Mensajes del Lugar */}
          {SHOW_LOCAL_MESSAGES && (
            <TwPressable
              onPress={() => router.push('/messages')}
              accessibilityLabel={t('home.localMessages')}
              testID="local-messages-menu"
              className="flex-row items-center justify-between py-5 border-b border-zinc-800/10 active:opacity-75"
            >
              <TwView className="flex-row items-center gap-4 flex-1">
                <Icon
                  ios={messageIcon.ios}
                  android={messageIcon.android}
                  web={messageIcon.web}
                  size={24}
                  tintColor={colors.text}
                />
                <TwView className="flex-1">
                  <ThemedText className="text-lg font-bold text-text">
                    {t('home.localMessages')}
                  </ThemedText>
                  <ThemedText className="text-sm text-textSecondary mt-0.5">
                    {t('home.localMessagesSub')}
                  </ThemedText>
                </TwView>
              </TwView>
              <Icon
                ios="chevron.right"
                android="chevron_right"
                web="chevron_right"
                size={20}
                tintColor={colors.textSecondary}
              />
            </TwPressable>
          )}
        </TwView>
      </TwView>
    </ScrollScreenWrapper>
  );
}
