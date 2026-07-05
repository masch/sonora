import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { TwView } from '@/tw';
import { AdminApiClient } from '@/services/admin-api-client';
import '@/global.css';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const key = AdminApiClient.getAuthKey();
    const inLoginGroup = segments[0] === 'login';

    if (!key && !inLoginGroup) {
      // Redirect to login page
      router.replace('/login');
    } else if (key && inLoginGroup) {
      // Redirect to main page if already logged in
      router.replace('/');
    }
    setIsReady(true);
  }, [segments]);

  if (!isReady) {
    return (
      <TwView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#8a6e53" />
      </TwView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ebe4d8',
        },
        headerTintColor: '#2b2826',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Sonora Admin - Translations' }} />
      <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
    </Stack>
  );
}
