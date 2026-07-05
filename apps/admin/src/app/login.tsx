import { AdminApiClient } from '@/services/admin-api-client';
import { TwPressable, TwText, TwTextInput, TwView } from '@/tw';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function LoginScreen() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError('Please enter your API Key');
      return;
    }
    const sanitized = trimmed.replace(/[^\x20-\x7E]/g, '');
    AdminApiClient.setAuthKey(sanitized);
    router.replace('/');
  };

  return (
    <TwView className="flex-1 items-center justify-center bg-background px-three">
      <TwView className="w-full max-w-[400px] card-container-solid rounded-xl p-five shadow-md">
        <TwText className="text-2xl font-bold text-text mb-one text-center">SONORA ADMIN</TwText>
        <TwText className="text-sm text-textSecondary mb-five text-center">
          Enter your API Admin Key to manage translations.
        </TwText>

        <TwView className="mb-four">
          <TwText className="text-xs font-semibold text-textSecondary mb-two">API Admin Key</TwText>
          <TwTextInput
            className="w-full h-11 border border-[#dfd7c8] rounded-lg px-three text-text bg-background focus:border-link"
            placeholder="bearer_token_key..."
            placeholderTextColor="#76706b"
            value={apiKey}
            onChangeText={(text) => {
              setApiKey(text);
              setError(null);
            }}
            secureTextEntry
          />
          {error && <TwText className="text-xs text-red-500 mt-one font-medium">{error}</TwText>}
        </TwView>

        <TwPressable
          className="w-full h-11 bg-link items-center justify-center rounded-lg active:opacity-90"
          onPress={handleLogin}
          accessibilityLabel="Log in button"
          testID="login-button"
        >
          <TwText className="text-base font-bold text-white">Log in</TwText>
        </TwPressable>
      </TwView>
    </TwView>
  );
}
