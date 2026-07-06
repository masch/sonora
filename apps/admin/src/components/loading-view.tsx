import { ActivityIndicator } from 'react-native';
import { TwText, TwView } from '@/tw';

import { useThemeColors } from '@/hooks/use-theme-colors';

interface LoadingViewProps {
  message?: string;
}

export default function LoadingView({ message }: LoadingViewProps) {
  const colors = useThemeColors();

  return (
    <TwView className="flex-1 items-center justify-center gap-2">
      <ActivityIndicator size="large" color={colors.link} />
      {message && <TwText className="text-sm text-textSecondary">{message}</TwText>}
    </TwView>
  );
}
