import { ActivityIndicator } from 'react-native';
import { TwText, TwView } from '@/tw';

interface LoadingViewProps {
  message?: string;
}

export default function LoadingView({ message }: LoadingViewProps) {
  return (
    <TwView className="flex-1 items-center justify-center gap-2">
      <ActivityIndicator size="large" color="#8a6e53" />
      {message && <TwText className="text-sm text-textSecondary">{message}</TwText>}
    </TwView>
  );
}
