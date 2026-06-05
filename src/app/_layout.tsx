import '@/global.css';
import '@/i18n';
import { fontConfig } from '@/config/font';

import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

// Load web font via Google Fonts CDN
if (typeof window !== 'undefined') {
  const link = window.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontConfig.googleFontsUrl;
  window.document.head.appendChild(link);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trips/[id]" options={{ headerShown: true }} />
      </Stack>
    </ThemeProvider>
  );
}
