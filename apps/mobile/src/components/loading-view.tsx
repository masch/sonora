import { ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TwView } from '@/tw';

interface LoadingViewProps {
  message?: string;
}

/**
 * Standard loading state: centered spinner + descriptive text.
 * Use in all async views that need a loading indicator.
 */
export default function LoadingView({ message }: LoadingViewProps) {
  return (
    <TwView className="flex-1 items-center justify-center gap-2">
      <ActivityIndicator />
      {message && <ThemedText type="small">{message}</ThemedText>}
    </TwView>
  );
}
