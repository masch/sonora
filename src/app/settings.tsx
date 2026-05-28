import { useAppTranslation } from '@/hooks/use-translation';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenWrapper } from '@/components/screen-wrapper';
import { TwView, TwText, TwScrollView, TwPressable } from '@/tw';

export default function SettingsScreen() {
  const { t } = useAppTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScreenWrapper className="flex-row justify-center">
      <SafeAreaView className="flex-1 max-w-[800px]">
        <TwScrollView className="flex-1 px-6 pt-4">
          {/* Header */}
          <TwView className="items-center justify-center py-16 gap-4">
            <TwText className="text-3xl font-bold text-center text-black dark:text-white">
              {t('settings.title')}
            </TwText>
            <TwText className="text-base text-center text-gray-500 dark:text-gray-400">
              {t('settings.subtitle')}
            </TwText>
          </TwView>

          {/* Profile Section */}
          <TwView className="rounded-2xl bg-gray-100 dark:bg-zinc-900 p-4 mb-4">
            <TwView className="flex-row items-center gap-4">
              <TwView className="w-16 h-16 rounded-full bg-blue-500 items-center justify-center">
                <TwText className="text-2xl font-bold text-white">{t('settings.profile.initials')}</TwText>
              </TwView>
              <TwView className="flex-1">
                <TwText className="text-lg font-semibold text-black dark:text-white">
                  {t('settings.profile.name')}
                </TwText>
                <TwText className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.profile.email')}
                </TwText>
              </TwView>
            </TwView>
          </TwView>

          {/* Preferences Section */}
          <TwView className="rounded-2xl bg-gray-100 dark:bg-zinc-900 p-4 mb-4">
            <TwText className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              {t('settings.section.preferences')}
            </TwText>

            <TwView className="gap-4">
              <TwView className="flex-row items-center justify-between">
                <TwText className="text-base text-black dark:text-white">
                  {t('settings.preferences.notifications')}
                </TwText>
                <TwView className="w-12 h-6 rounded-full bg-green-500" />
              </TwView>

              <TwView className="flex-row items-center justify-between">
                <TwText className="text-base text-black dark:text-white">
                  {t('settings.preferences.darkMode')}
                </TwText>
                <TwText className="text-base text-gray-500 dark:text-gray-400">
                  {isDark ? t('settings.preferences.darkModeValue.on') : t('settings.preferences.darkModeValue.off')}
                </TwText>
              </TwView>

              <TwView className="flex-row items-center justify-between">
                <TwText className="text-base text-black dark:text-white">
                  {t('settings.preferences.language')}
                </TwText>
                <TwText className="text-base text-gray-500 dark:text-gray-400">
                  {t('settings.language.label')}
                </TwText>
              </TwView>
            </TwView>
          </TwView>

          {/* About Section */}
          <TwView className="rounded-2xl bg-gray-100 dark:bg-zinc-900 p-4 mb-8">
            <TwText className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              {t('settings.section.about')}
            </TwText>

            <TwView className="gap-3">
              <TwView className="flex-row items-center justify-between">
                <TwText className="text-base text-black dark:text-white">
                  {t('settings.about.version')}
                </TwText>
                <TwText className="text-base text-gray-500 dark:text-gray-400">
                  {t('settings.about.versionValue')}
                </TwText>
              </TwView>

              <TwPressable
                className="flex-row items-center justify-between active:opacity-70"
                onPress={() => {}}>
                <TwText className="text-base text-blue-500">{t('settings.about.terms')}</TwText>
              </TwPressable>

              <TwPressable
                className="flex-row items-center justify-between active:opacity-70"
                onPress={() => {}}>
                <TwText className="text-base text-blue-500">{t('settings.about.privacy')}</TwText>
              </TwPressable>
            </TwView>
          </TwView>

          {/* Bottom inset */}
          {Platform.OS === 'web' && (
            <TwView className="items-center py-8">
              <TwText className="text-sm text-gray-500 dark:text-gray-400">
                {t('settings.footer')}
              </TwText>
            </TwView>
          )}
        </TwScrollView>
      </SafeAreaView>
    </ScreenWrapper>
  );
}
