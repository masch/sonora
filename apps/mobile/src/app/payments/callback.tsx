import { useLocalSearchParams } from 'expo-router';
import PaymentCallback from '@/components/payment-callback';

export default function CallbackScreen() {
  const { status } = useLocalSearchParams<{ status?: 'success' | 'failure' | 'pending' }>();
  return <PaymentCallback status={status || 'success'} />;
}
