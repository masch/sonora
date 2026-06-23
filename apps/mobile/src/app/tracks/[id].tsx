import { useLocalSearchParams } from 'expo-router';

import TrackDetailView from '@/components/track-detail-view';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';

const CONTENT_PADDING = 'pb-6';

// Dynamic track detail route — reads the track ID from the URL path.
// Rendering is handled by TrackDetailView shared component.
export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollScreenWrapper
      withTabBar={false}
      disableBottomPadding
      contentContainerClassName={CONTENT_PADDING}
    >
      <TrackDetailView trackId={id ?? ''} />
    </ScrollScreenWrapper>
  );
}
