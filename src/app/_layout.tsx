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

  const [fontsLoaded, fontError] = useFonts({
    Caveat: require('@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf'),
    'Caveat-Medium': require('@expo-google-fonts/caveat/500Medium/Caveat_500Medium.ttf'),
    'Caveat-SemiBold': require('@expo-google-fonts/caveat/600SemiBold/Caveat_600SemiBold.ttf'),
    'Caveat-Bold': require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf'),
  });

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
