import { useAppTranslation } from '@/hooks/use-translation';
import { Platform } from 'react-native';

import { TwView, TwPressable } from '@/tw';
import { TwImage } from '@/tw/image';
import { ScrollScreenWrapper, TAB_BAR_INSET } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { SONORA_LOGO, SONORA_BANNER_BG, SONORA_MAIN_BG } from '@/constants/images';

export default function SettingsScreen() {
  const { t } = useAppTranslation();
  const { isDark } = useColorScheme();
  const colors = useThemeColors();

  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerClassName="pb-6">
      <TwView className="flex-1">
        {/* Top Banner */}
        <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
          <TwImage
            source={SONORA_BANNER_BG}
            className="absolute inset-0 w-full h-full"
            contentFit="cover"
            alt=""
          />
          <TwView className="size-40 items-center justify-center z-10">
            <TwImage source={SONORA_LOGO} className="w-full h-full" contentFit="contain" alt="" />
          </TwView>
          <TwView className="absolute top-4 right-4 bg-white/20 p-2 rounded-full backdrop-blur-md">
            <Icon
              ios="speaker.wave.2.fill"
              android="volume_up"
              web="volume_up"
              size={18}
              tintColor="#000000"
            />
          </TwView>
        </TwView>

        {/* Main Content Area */}
        <TwView
          className="relative flex-1 gap-4 p-4"
          style={Platform.OS === 'ios' ? { paddingBottom: TAB_BAR_INSET } : undefined}
        >
          <TwImage source={SONORA_MAIN_BG} className="absolute inset-0" contentFit="cover" alt="" />

          {/* Header Card */}
          <TwView className="w-full max-w-[800px] self-center card-container-solid p-6 rounded-[24px] shadow-md backdrop-blur-md gap-2 z-10">
            <ThemedText className="text-2xl font-black text-center text-zinc-800 dark:text-zinc-100 tracking-wider">
              {t('settings.title')}
            </ThemedText>
            <ThemedText className="text-center font-bold text-zinc-600 dark:text-zinc-400 text-[11px] uppercase tracking-wider">
              {t('settings.subtitle')}
            </ThemedText>
          </TwView>

          {/* Profile Section */}
          <TwView className="w-full max-w-[800px] self-center card-container-solid p-4 rounded-[24px] shadow-md backdrop-blur-md z-10">
            <TwView className="flex-row items-center gap-4">
              <TwView className="size-16 rounded-full bg-emerald-500 items-center justify-center shadow-sm">
                <ThemedText className="text-xl font-black text-white">
                  {t('settings.profile.initials')}
                </ThemedText>
              </TwView>
              <TwView className="flex-1">
                <ThemedText className="text-base font-extrabold text-zinc-800 dark:text-zinc-100 leading-tight">
                  {t('settings.profile.name')}
                </ThemedText>
                <ThemedText className="text-[12px] font-bold text-zinc-600 dark:text-zinc-400">
                  {t('settings.profile.email')}
                </ThemedText>
              </TwView>
            </TwView>
          </TwView>

          {/* Preferences Section */}
          <TwView className="w-full max-w-[800px] self-center card-container-solid p-4 rounded-[24px] shadow-md backdrop-blur-md z-10">
            <ThemedText className="text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-4">
              {t('settings.section.preferences')}
            </ThemedText>

            <TwView className="gap-4">
              <TwView className="flex-row items-center justify-between p-3 rounded-xl card-container">
                <ThemedText className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {t('settings.preferences.notifications')}
                </ThemedText>
                <TwView className="w-10 h-6 rounded-full bg-emerald-500 items-end justify-center px-1">
                  <TwView className="size-4 rounded-full bg-white shadow-sm" />
                </TwView>
              </TwView>

              <TwView className="flex-row items-center justify-between p-3 rounded-xl card-container">
                <ThemedText className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {t('settings.preferences.darkMode')}
                </ThemedText>
                <ThemedText className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  {isDark
                    ? t('settings.preferences.darkModeValue.on')
                    : t('settings.preferences.darkModeValue.off')}
                </ThemedText>
              </TwView>

              <TwView className="flex-row items-center justify-between p-3 rounded-xl card-container">
                <ThemedText className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {t('settings.preferences.language')}
                </ThemedText>
                <ThemedText className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  {t('settings.language.label')}
                </ThemedText>
              </TwView>
            </TwView>
          </TwView>

          {/* About Section */}
          <TwView className="w-full max-w-[800px] self-center card-container-solid p-4 rounded-[24px] shadow-md backdrop-blur-md z-10">
            <ThemedText className="text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-4">
              {t('settings.section.about')}
            </ThemedText>

            <TwView className="gap-3">
              <TwView className="flex-row items-center justify-between p-3 rounded-xl card-container">
                <ThemedText className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {t('settings.about.version')}
                </ThemedText>
                <ThemedText className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  {t('settings.about.versionValue')}
                </ThemedText>
              </TwView>

              <TwPressable
                accessibilityLabel={t('settings.about.terms')}
                testID="terms-button"
                className="flex-row items-center justify-between p-3 rounded-xl card-container active:opacity-70"
                onPress={() => {}}
              >
                <ThemedText className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {t('settings.about.terms')}
                </ThemedText>
                <Icon
                  ios="chevron.right"
                  android="chevron_right"
                  web="chevron_right"
                  size={16}
                  tintColor={colors.textSecondary}
                />
              </TwPressable>

              <TwPressable
                accessibilityLabel={t('settings.about.privacy')}
                testID="privacy-button"
                className="flex-row items-center justify-between p-3 rounded-xl card-container active:opacity-70"
                onPress={() => {}}
              >
                <ThemedText className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {t('settings.about.privacy')}
                </ThemedText>
                <Icon
                  ios="chevron.right"
                  android="chevron_right"
                  web="chevron_right"
                  size={16}
                  tintColor={colors.textSecondary}
                />
              </TwPressable>
            </TwView>
          </TwView>

          {/* Bottom inset */}
          {Platform.OS === 'web' && (
            <TwView className="items-center py-8 z-10">
              <ThemedText className="text-xs font-semibold text-zinc-500">
                {t('settings.footer')}
              </ThemedText>
            </TwView>
          )}
        </TwView>
      </TwView>
    </ScrollScreenWrapper>
  );
}
