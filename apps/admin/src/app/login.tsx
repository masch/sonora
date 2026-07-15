import { ScreenWrapper } from '@/components/screen-wrapper';
import { AdminApiClient } from '@/services/admin-api-client';
import { TwPressable, TwText, TwTextInput, TwView } from '@/tw';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '@/hooks/use-theme-colors';

export default function LoginScreen() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const colors = useThemeColors();

  const handleLogin = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError(t('login.errorEmpty'));
      return;
    }
    const sanitized = trimmed.replace(/[^\x20-\x7E]/g, '');
    setIsLoading(true);
    setError(null);
    try {
      const isValid = await AdminApiClient.validateKey(sanitized);
      if (!isValid) {
        setError(t('login.errorInvalid'));
        return;
      }
      AdminApiClient.setAuthKey(sanitized);
      router.replace('/');
    } catch {
      setError(t('common.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenWrapper className="items-center justify-center px-three">
      <TwView className="w-full max-w-[400px] card-container-solid rounded-xl p-five shadow-md">
        <TwText className="text-2xl font-bold text-text mb-one text-center">
          {t('login.title')}
        </TwText>
        <TwText className="text-sm text-textSecondary mb-five text-center">
          {t('login.subtitle')}
        </TwText>

        <TwView className="mb-four">
          <TwText className="text-xs font-semibold text-textSecondary mb-two">
            {t('login.keyLabel')}
          </TwText>
          <TwTextInput
            className="w-full h-11 border border-backgroundSelected rounded-lg px-three text-text bg-background focus:border-link"
            placeholder={t('login.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={apiKey}
            onChangeText={(text) => {
              setApiKey(text);
              setError(null);
            }}
            secureTextEntry
            editable={!isLoading}
            accessibilityLabel={t('login.keyInputLabel')}
            testID="api-key-input"
          />
          {error && <TwText className="text-xs text-red-500 mt-one font-medium">{error}</TwText>}
        </TwView>

        <TwPressable
          className={`w-full h-11 bg-link items-center justify-center rounded-lg active:opacity-90 ${isLoading ? 'opacity-50' : ''}`}
          onPress={handleLogin}
          disabled={isLoading}
          accessibilityLabel={t('login.loginBtnLabel')}
          testID="login-button"
        >
          <TwText className="text-base font-bold text-white">
            {isLoading ? t('dashboard.savingBtn') : t('login.loginBtn')}
          </TwText>
        </TwPressable>
      </TwView>
    </ScreenWrapper>
  );
}
