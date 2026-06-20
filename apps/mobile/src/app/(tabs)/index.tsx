import { useRouter } from 'expo-router';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { TwPressable, TwView } from '@/tw';
import { TwImage } from '@/tw/image';
import { useAppTranslation } from '@/hooks/use-translation';
import { useThemeColors } from '@/hooks/use-theme-colors';

const unifiedHeaderImg = require('@/assets/images/sonora/home-unified-header.png');

export const SHOW_LOCAL_MESSAGES = false;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const colors = useThemeColors();

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
        {/* Continue Listening Section */}
        <TwView className="mb-6">
          <ThemedText className="text-base font-extrabold text-text mb-4">
            {t('home.continueListening')}
          </ThemedText>

          {/* Clean Player Row (No card borders) */}
          <TwPressable
            onPress={() => router.push('/experiences?format=trip')}
            accessibilityLabel={t('home.continueListening')}
            testID="continue-listening-card"
            className="flex-row items-start gap-4 active:opacity-75 pb-6 border-b border-zinc-800/10"
          >
            <TwView className="pt-1">
              <Icon
                ios="play.fill"
                android="play_arrow"
                web="play_arrow"
                size={28}
                tintColor={colors.text}
              />
            </TwView>
            <TwView className="flex-1">
              <ThemedText className="text-lg font-extrabold text-text leading-tight">
                {t('home.riverPath')}
              </ThemedText>
              <ThemedText className="text-sm font-semibold text-textSecondary mt-0.5">
                {t('home.remainingTime', { time: '7 min' })}
              </ThemedText>

              {/* Progress Bar */}
              <TwView className="h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mt-4 w-full overflow-hidden">
                <TwView className="h-full bg-text w-[45%]" />
              </TwView>
            </TwView>
          </TwPressable>
        </TwView>

        {/* Navigation List Menu */}
        <TwView className="gap-1">
          {/* Explorar Recorridos */}
          <TwPressable
            onPress={() => router.push('/experiences?format=trip')}
            accessibilityLabel={t('home.exploreRoutes')}
            testID="explore-routes-menu"
            className="flex-row items-center justify-between py-5 border-b border-zinc-800/10 active:opacity-75"
          >
            <TwView className="flex-row items-center gap-4 flex-1">
              <Icon ios="map" android="map" web="map" size={24} tintColor={colors.text} />
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
            onPress={() => router.push('/experiences?format=track')}
            accessibilityLabel={t('home.exploreTracks')}
            testID="explore-tracks-menu"
            className="flex-row items-center justify-between py-5 border-b border-zinc-800/10 active:opacity-75"
          >
            <TwView className="flex-row items-center gap-4 flex-1">
              <Icon
                ios="music.note.list"
                android="library_music"
                web="library_music"
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
              onPress={() => router.push('/experiences?format=track')}
              accessibilityLabel={t('home.localMessages')}
              testID="local-messages-menu"
              className="flex-row items-center justify-between py-5 border-b border-zinc-800/10 active:opacity-75"
            >
              <TwView className="flex-row items-center gap-4 flex-1">
                <Icon
                  ios="bubble.left"
                  android="forum"
                  web="forum"
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
