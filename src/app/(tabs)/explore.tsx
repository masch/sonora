import TripMap from '@/components/trip-map';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';

export default function ExploreScreen() {
  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerStyle={{ flexGrow: 1 }}>
      <TripMap />
    </ScrollScreenWrapper>
  );
}
