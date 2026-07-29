import { useEffect } from 'react';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import LoadingView from '@/components/loading-view';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '@/config/app-config';
import { StagingBadge } from '@/components/staging-badge';
import { TwPressable, TwText, TwView } from '@/tw';
import '@/global.css';
import '@/i18n';

function ProtectedLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (isLoading) return;

    const inLoginGroup = segments[0] === 'login';

    if (!isAuthenticated && !inLoginGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inLoginGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return <LoadingView message={t('dashboard.loadingConfig')} />;
  }

  return (
    <>
      {!APP_CONFIG.isProduction && <StagingBadge />}
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t('login.title'), headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProtectedLayoutNav />
    </AuthProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();

  return (
    <TwView className="flex-1 justify-center items-center p-six bg-background">
      <TwText className="text-xl font-bold text-text mb-two">
        {t('common.somethingWentWrong')}
      </TwText>
      <TwText className="text-red-500 text-center mb-six">{error.message}</TwText>
      <TwPressable
        className="px-six py-three bg-link rounded-lg active:opacity-90"
        onPress={retry}
        accessibilityLabel={t('common.retry')}
        testID="retry-button"
      >
        <TwText className="text-white font-medium">{t('common.retry')}</TwText>
      </TwPressable>
    </TwView>
  );
}
