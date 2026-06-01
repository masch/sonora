import { useLocalSearchParams } from 'expo-router';

import TripDetailView from '@/components/trip-detail-view';

// Dynamic trip detail route — reads the trip ID from the URL path.
// Rendering is handled by TripDetailView shared component.
export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TripDetailView tripId={id ?? ''} />;
}
