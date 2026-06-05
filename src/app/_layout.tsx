import '@/global.css';
import '@/i18n';
import { fontConfig } from '@/config/font';

import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

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
  const colorScheme = useColorScheme();

  // Each weight registered under the same fontFamily='Caveat' so Android
  // resolves fontFamily + fontWeight correctly (bold, medium, etc.).
  // The extra props (fontFamily, fontWeight) are used by the native module
  // even though the TS types don't expose them.
  const fontMap: Record<string, Record<string, unknown>> = {
    CaveatRegular: {
      uri: require('@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf'),
      fontFamily: fontConfig.family,
      fontWeight: '400',
    },
    CaveatMedium: {
      uri: require('@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf'),
      fontFamily: fontConfig.family,
      fontWeight: '500',
    },
    CaveatSemiBold: {
      uri: require('@expo-google-fonts/caveat/600SemiBold/Caveat_600SemiBold.ttf'),
      fontFamily: fontConfig.family,
      fontWeight: '600',
    },
    CaveatBold: {
      uri: require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf'),
      fontFamily: fontConfig.family,
      fontWeight: '700',
    },
  };
  const [fontsLoaded, fontError] = useFonts(fontMap);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trips/[id]" options={{ headerShown: true }} />
      </Stack>
    </ThemeProvider>
  );
}
