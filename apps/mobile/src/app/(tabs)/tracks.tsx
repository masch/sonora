import TripMap from '@/components/trip-map';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';

export default function TracksScreen() {
  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerClassName="grow">
      <TripMap />
    </ScrollScreenWrapper>
  );
}
