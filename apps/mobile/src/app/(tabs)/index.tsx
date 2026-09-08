import { AppLogo } from '@/components/app-logo';
import { Icon } from '@/components/icon';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { ROUTES } from '@/constants/routes';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwPressable, TwView } from '@/tw';
import { getExperienceIcon } from '@/utils/icons';
import { useRouter } from 'expo-router';

import { PopupImageModal } from '@/components/popup-image-modal';
import { SONORA_HOME_BG, SONORA_HOME_MAP } from '@/constants/images';

export const SHOW_LOCAL_MESSAGES = false;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tripIcon = getExperienceIcon('trip');
  const trackIcon = getExperienceIcon('track');
  const messageIcon = getExperienceIcon('general-feedback');

  return (
    <ScrollScreenWrapper
      disableBottomPadding
      backgroundImage={SONORA_HOME_BG}
      contentContainerClassName="grow pb-8"
    >
      {/* Top Header - Unified Mockup Header Image */}
      <TwView className="relative w-full h-[380px] border-b border-zinc-800/15">
        <AppLogo className="w-full h-full" />
        {/* Hidden text layers for accessibility and test suites */}
        <TwView className="absolute -top-9999 left-0 opacity-0">
          <ThemedText>{t('home.title')}</ThemedText>
          <ThemedText>{t('home.poetic')}</ThemedText>
        </TwView>
      </TwView>

      {/* Main Content Area */}
      <TwView className="px-8 pt-6">
        {/* Navigation List Menu */}
        <TwView className="gap-3">
          {/* Sonora map */}
          <PopupImageModal source={SONORA_HOME_MAP} alt={t('home.mapAlt')} />

          {/* Explore trips */}
          <TwPressable
            onPress={() => router.push(ROUTES.PATH.DERIVAS)}
            accessibilityLabel={t('home.exploreRoutes')}
            testID="explore-routes-menu"
            className="flex-row items-center justify-between px-6 py-5 rounded-[24px] active:opacity-75"
            style={{ backgroundColor: colors.homeExploreRoutesBg }}
          >
            <TwView className="flex-row items-center gap-4 flex-1">
              <Icon
                ios={tripIcon.ios}
                android={tripIcon.android}
                web={tripIcon.web}
                size={24}
                tintColor={colors.homeCardText}
              />
              <TwView className="flex-1">
                <ThemedText className="text-lg font-bold" style={{ color: colors.homeCardText }}>
                  {t('home.exploreRoutes')}
                </ThemedText>
                <ThemedText className="text-sm mt-0.5" style={{ color: colors.homeCardSubtext }}>
                  {t('home.exploreRoutesSub')}
                </ThemedText>
              </TwView>
            </TwView>
            <Icon
              ios="chevron.right"
              android="chevron_right"
              web="chevron_right"
              size={20}
              tintColor={colors.homeCardText}
            />
          </TwPressable>

          {/* Explore Tracks */}
          <TwPressable
            onPress={() => router.push(ROUTES.PATH.POETICS)}
            accessibilityLabel={t('home.exploreTracks')}
            testID="explore-tracks-menu"
            className="flex-row items-center justify-between px-6 py-5 rounded-[24px] active:opacity-75"
            style={{ backgroundColor: colors.homeExploreTracksBg }}
          >
            <TwView className="flex-row items-center gap-4 flex-1">
              <Icon
                ios={trackIcon.ios}
                android={trackIcon.android}
                web={trackIcon.web}
                size={24}
                tintColor={colors.homeCardText}
              />
              <TwView className="flex-1">
                <ThemedText className="text-lg font-bold" style={{ color: colors.homeCardText }}>
                  {t('home.exploreTracks')}
                </ThemedText>
                <ThemedText className="text-sm mt-0.5" style={{ color: colors.homeCardSubtext }}>
                  {t('home.exploreTracksSub')}
                </ThemedText>
              </TwView>
            </TwView>
            <Icon
              ios="chevron.right"
              android="chevron_right"
              web="chevron_right"
              size={20}
              tintColor={colors.homeCardText}
            />
          </TwPressable>

          {/* Messages */}
          {SHOW_LOCAL_MESSAGES && (
            <TwPressable
              onPress={() => router.push(ROUTES.PATH.MESSAGES)}
              accessibilityLabel={t('home.localMessages')}
              testID="local-messages-menu"
              className="flex-row items-center justify-between px-6 py-5 rounded-[24px] active:opacity-75"
              style={{ backgroundColor: colors.homeLocalMessagesBg }}
            >
              <TwView className="flex-row items-center gap-4 flex-1">
                <Icon
                  ios={messageIcon.ios}
                  android={messageIcon.android}
                  web={messageIcon.web}
                  size={24}
                  tintColor={colors.homeCardText}
                />
                <TwView className="flex-1">
                  <ThemedText className="text-lg font-bold" style={{ color: colors.homeCardText }}>
                    {t('home.localMessages')}
                  </ThemedText>
                  <ThemedText className="text-sm mt-0.5" style={{ color: colors.homeCardSubtext }}>
                    {t('home.localMessagesSub')}
                  </ThemedText>
                </TwView>
              </TwView>
              <Icon
                ios="chevron.right"
                android="chevron_right"
                web="chevron_right"
                size={20}
                tintColor={colors.homeCardText}
              />
            </TwPressable>
          )}
        </TwView>

        {/* Spacer to match the padding between elements */}
        <TwView className="h-3" />
      </TwView>
    </ScrollScreenWrapper>
  );
}
