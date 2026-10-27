import { fontConfig } from '@/config/font';
import '@/global.css';
import { addResources } from '@/i18n';
import { APP_CONFIG } from '@/config/app-config';
import { StagingBadge } from '@/components/staging-badge';

import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  ErrorBoundaryProps,
  router,
  usePathname,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
import { updateService } from '@/services/update-service';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { GlobalAudioPlayer } from '@/components/global-audio-player';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { useTranslationStore } from '@/store/translation-store';
import { useTermsCheck } from '@/hooks/use-terms-check';
import { TermsModal } from '@/components/terms-modal';
import { MapDownloadPrompt } from '@/components/map/map-download-prompt';
import { AndroidWebGate } from '@/components/android-web-gate';
import { ErrorScreen } from '@/components/error-screen';
import { logger } from '@/utils/logger';
import { errorReference } from '@/utils/error-reference';

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

  // Subscribe to translation overrides and push into i18next when they change
  const overridesByLang = useTranslationStore((s) => s.overridesByLang);

  useEffect(() => {
    if (Object.keys(overridesByLang).length > 0) {
      addResources(overridesByLang);
    }
  }, [overridesByLang]);

  // Subscribe to version status
  const versionStatus = useRemoteConfigStore((s) => s.versionStatus);

  // Check Terms and Conditions acceptance
  const termsCheck = useTermsCheck();

  // Initialise remote config, translation overrides, and app startup checks on load
  useEffect(() => {
    const remoteConfigPromise = useRemoteConfigStore.getState().init();
    void useTranslationStore.getState().init();

    AnalyticsService.trackEvent('app_open');
    void updateService.checkForInstalledUpdate();

    void (async () => {
      try {
        // Wait for remote config initialization to complete so versionStatus is authoritative
        await remoteConfigPromise;
        const hasUpdate = await updateService.checkForUpdate({ source: 'startup' });
        if (hasUpdate && useRemoteConfigStore.getState().versionStatus !== 'block') {
          await updateService.triggerUpdate({ mode: 'flexible' });
        }
      } catch (err) {
        logger.warn('[UpdateService] Startup update check failed:', err);
      }
    })();
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
      <TermsModal
        visible={termsCheck.isBlocking}
        terms={termsCheck.terms}
        blockingError={termsCheck.blockingError}
        error={termsCheck.error}
        onAccept={termsCheck.acceptTerms}
        onRetry={termsCheck.retry}
      />
      <AndroidWebGate />
      <MapDownloadPrompt />
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // `usePathname` reads expo-router's global route store, not a navigation
  // context, so it is safe to call even when the boundary fires before the
  // navigator mounts.
  const route = usePathname();
  const reference = errorReference(error);

  useEffect(() => {
    AnalyticsService.recordError(error, 'Root ErrorBoundary caught layout/render error', {
      reference,
      route,
      fatal: true,
    });
  }, [error, reference, route]);

  return <ErrorScreen error={error} retry={retry} onGoHome={() => router.replace('/')} />;
}
