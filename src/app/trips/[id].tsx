import { useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';

import TripDetailView from '@/components/trip-detail-view';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';

const CONTENT_PADDING = 'pt-16 pb-6';

// Dynamic trip detail route — reads the trip ID from the URL path.
// Rendering is handled by TripDetailView shared component.
export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollScreenWrapper withTabBar={false} contentContainerClassName={CONTENT_PADDING}>
      <TripDetailView tripId={id ?? ''} isWeb={Platform.OS === 'web'} />
    </ScrollScreenWrapper>
  );
}
