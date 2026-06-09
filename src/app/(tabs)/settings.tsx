import { useAppTranslation } from '@/hooks/use-translation';
import { Platform, useColorScheme } from 'react-native';

import { TwView, TwPressable } from '@/tw';
import { TwImage } from '@/tw/image';
import { ScrollScreenWrapper, TAB_BAR_INSET } from '@/components/screen-wrapper';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';

const bannerBg = require('@/assets/images/sonora/banner-fondo-logo-1.png');
const logoImg = require('@/assets/images/sonora/logo.png');
const mainBg = require('@/assets/images/sonora/fondo-recorridos-sec-1.png');

export default function SettingsScreen() {
  const { t } = useAppTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerClassName="pb-6">
      <TwView className="flex-1">
        {/* Top Banner */}
        <TwView className="relative w-full h-48 overflow-hidden items-center justify-center bg-zinc-950">
          <TwImage
            source={bannerBg}
            className="absolute inset-0 w-full h-full"
            contentFit="cover"
            alt=""
          />
          <TwView className="w-40 h-40 items-center justify-center z-10">
            <TwImage source={logoImg} className="w-full h-full" contentFit="contain" alt="" />
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
          <TwImage source={mainBg} className="absolute inset-0" contentFit="cover" alt="" />

          {/* Header Card */}
          <TwView className="w-full max-w-[800px] self-center bg-white/80 p-6 rounded-[24px] shadow-md backdrop-blur-md gap-2 z-10">
            <ThemedText className="text-2xl font-black text-center text-zinc-800 tracking-wider">
              {t('settings.title')}
            </ThemedText>
            <ThemedText className="text-center font-bold text-zinc-600 text-[11px] uppercase tracking-wider">
              {t('settings.subtitle')}
            </ThemedText>
          </TwView>

          {/* Profile Section */}
          <TwView className="w-full max-w-[800px] self-center bg-white/80 p-4 rounded-[24px] shadow-md backdrop-blur-md z-10">
            <TwView className="flex-row items-center gap-4">
              <TwView className="size-16 rounded-full bg-emerald-500 items-center justify-center shadow-sm">
                <ThemedText className="text-xl font-black text-white">
                  {t('settings.profile.initials')}
                </ThemedText>
              </TwView>
              <TwView className="flex-1">
                <ThemedText className="text-base font-extrabold text-zinc-800 leading-tight">
                  {t('settings.profile.name')}
                </ThemedText>
                <ThemedText className="text-[12px] font-bold text-zinc-600">
                  {t('settings.profile.email')}
                </ThemedText>
              </TwView>
            </TwView>
          </TwView>

          {/* Preferences Section */}
          <TwView className="w-full max-w-[800px] self-center bg-white/80 p-4 rounded-[24px] shadow-md backdrop-blur-md z-10">
            <ThemedText className="text-[11px] font-black uppercase tracking-wider text-zinc-600 mb-4">
              {t('settings.section.preferences')}
            </ThemedText>

            <TwView className="gap-4">
              <TwView className="flex-row items-center justify-between p-3 rounded-xl bg-white/50 border border-zinc-200/30">
                <ThemedText className="text-sm font-bold text-zinc-800">
                  {t('settings.preferences.notifications')}
                </ThemedText>
                <TwView className="w-10 h-6 rounded-full bg-emerald-500 items-end justify-center px-1">
                  <TwView className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </TwView>
              </TwView>

              <TwView className="flex-row items-center justify-between p-3 rounded-xl bg-white/50 border border-zinc-200/30">
                <ThemedText className="text-sm font-bold text-zinc-800">
                  {t('settings.preferences.darkMode')}
                </ThemedText>
                <ThemedText className="text-xs font-bold text-zinc-600">
                  {isDark
                    ? t('settings.preferences.darkModeValue.on')
                    : t('settings.preferences.darkModeValue.off')}
                </ThemedText>
              </TwView>

              <TwView className="flex-row items-center justify-between p-3 rounded-xl bg-white/50 border border-zinc-200/30">
                <ThemedText className="text-sm font-bold text-zinc-800">
                  {t('settings.preferences.language')}
                </ThemedText>
                <ThemedText className="text-xs font-bold text-zinc-600">
                  {t('settings.language.label')}
                </ThemedText>
              </TwView>
            </TwView>
          </TwView>

          {/* About Section */}
          <TwView className="w-full max-w-[800px] self-center bg-white/80 p-4 rounded-[24px] shadow-md backdrop-blur-md z-10">
            <ThemedText className="text-[11px] font-black uppercase tracking-wider text-zinc-600 mb-4">
              {t('settings.section.about')}
            </ThemedText>

            <TwView className="gap-3">
              <TwView className="flex-row items-center justify-between p-3 rounded-xl bg-white/50 border border-zinc-200/30">
                <ThemedText className="text-sm font-bold text-zinc-800">
                  {t('settings.about.version')}
                </ThemedText>
                <ThemedText className="text-xs font-bold text-zinc-600">
                  {t('settings.about.versionValue')}
                </ThemedText>
              </TwView>

              <TwPressable
                accessibilityLabel={t('settings.about.terms')}
                testID="terms-button"
                className="flex-row items-center justify-between p-3 rounded-xl bg-white/50 border border-zinc-200/30 active:opacity-70"
                onPress={() => {}}
              >
                <ThemedText className="text-sm font-bold text-zinc-800">
                  {t('settings.about.terms')}
                </ThemedText>
                <Icon
                  ios="chevron.right"
                  android="chevron_right"
                  web="chevron_right"
                  size={16}
                  tintColor="#71717a"
                />
              </TwPressable>

              <TwPressable
                accessibilityLabel={t('settings.about.privacy')}
                testID="privacy-button"
                className="flex-row items-center justify-between p-3 rounded-xl bg-white/50 border border-zinc-200/30 active:opacity-70"
                onPress={() => {}}
              >
                <ThemedText className="text-sm font-bold text-zinc-800">
                  {t('settings.about.privacy')}
                </ThemedText>
                <Icon
                  ios="chevron.right"
                  android="chevron_right"
                  web="chevron_right"
                  size={16}
                  tintColor="#71717a"
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
