import { fontConfig } from '@/config/font';
import '@/global.css';
import { addResources } from '@/i18n';
import { APP_CONFIG } from '@/config/app-config';
import { StagingBadge } from '@/components/staging-badge';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppTranslation } from '@/hooks/use-translation';
import { RuntimeColors } from '@/constants/theme';

import { ROUTES } from '@/constants/routes';

import { useLocationStore } from '@/store/location-store';
import { useFeedbackSync } from '@/hooks/use-feedback-sync';
import { useBackgroundSync } from '@/hooks/use-background-sync';
import { AudioPlayerBridge } from '@/components/audio-player-bridge';
import { InterruptConfirmationModal } from '@/components/interrupt-confirmation-modal';
import { UpdateRequiredModal } from '@/components/update-required-modal';
import { UpdateWarningBanner } from '@/components/update-warning-banner';
import { AnalyticsService } from '@/services/analytics';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { GlobalAudioPlayer } from '@/components/global-audio-player';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { useTranslationStore } from '@/store/translation-store';
import { TwView, TwText, TwPressable } from '@/tw';

// Load web font via Google Fonts CDN (web only — document does not exist on native)
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontConfig.googleFontsUrl;
  document.head.appendChild(link);
}

// Enable global unhandled promise rejection tracking
AnalyticsService.initializeGlobalErrorTracking();

// Keep splash visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isDark } = useColorScheme();

  const [fontsLoaded, fontError] = useFonts(fontConfig.expoFontMap());

  // Initialize sync hooks on app load
  useFeedbackSync();
  useBackgroundSync();

  // Start location subscription on app load
  useEffect(() => {
    const unsubscribe = useLocationStore.getState().startWatching();
    return () => {
      unsubscribe();
    };
  }, []);

  // Initialise remote config and translation overrides on app load
  useEffect(() => {
    useRemoteConfigStore.getState().init();
    useTranslationStore.getState().init();
  }, []);

  // Subscribe to translation overrides and push into i18next when they change
  const overridesByLang = useTranslationStore((s) => s.overridesByLang);

  useEffect(() => {
    if (Object.keys(overridesByLang).length > 0) {
      addResources(overridesByLang);
    }
  }, [overridesByLang]);

  // Subscribe to version status
  const versionStatus = useRemoteConfigStore((s) => s.versionStatus);

  // Track app open event
  useEffect(() => {
    AnalyticsService.trackEvent('app_open');
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const themeColors = isDark ? RuntimeColors.dark : RuntimeColors.light;
  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const navTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: themeColors.background,
      card: themeColors.background,
      text: themeColors.text,
      border: themeColors.border,
    },
  };

  if (!fontsLoaded && !fontError) {
    return (
      <ThemeProvider value={navTheme}>
        <AnimatedSplashOverlay isReady={false} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <AnimatedSplashOverlay isReady={true} />
      {!APP_CONFIG.isProduction && <StagingBadge />}
      <AudioPlayerBridge />
      {versionStatus === 'warn' && <UpdateWarningBanner />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name={`${ROUTES.POETICS}/[id]`} options={{ headerShown: true }} />
      </Stack>
      <GlobalAudioPlayer />
      <InterruptConfirmationModal />
      {versionStatus === 'block' && <UpdateRequiredModal />}
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useAppTranslation();

  useEffect(() => {
    AnalyticsService.recordError(error, 'Root ErrorBoundary caught layout/render error');
  }, [error]);

  return (
    <TwView className="flex-1 justify-center items-center p-6 bg-slate-900">
      <TwText className="text-xl font-bold text-white mb-2">
        {t('common.somethingWentWrong')}
      </TwText>
      <TwText className="text-red-400 text-center mb-6">{error.message}</TwText>
      <TwPressable
        className="px-6 py-3 bg-indigo-600 rounded-lg active:bg-indigo-700"
        onPress={retry}
        accessibilityLabel={t('common.retry')}
        testID="retry-button"
      >
        <TwText className="text-white font-medium">{t('common.retry')}</TwText>
      </TwPressable>
    </TwView>
  );
}
