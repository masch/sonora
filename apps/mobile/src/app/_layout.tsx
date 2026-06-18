import { fontConfig } from '@/config/font';
import '@/global.css';
import '@/i18n';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RuntimeColors } from '@/constants/theme';

import { useLocationStore } from '@/store/location-store';
import { useFeedbackSync } from '@/hooks/use-feedback-sync';
import { useBackgroundSync } from '@/hooks/use-background-sync';

// Load web font via Google Fonts CDN (web only — document does not exist on native)
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontConfig.googleFontsUrl;
  document.head.appendChild(link);
}

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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trips/[id]" options={{ headerShown: true }} />
      </Stack>
    </ThemeProvider>
  );
}
