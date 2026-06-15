import TripMap from '@/components/trip-map';
import { ScrollScreenWrapper } from '@/components/screen-wrapper';

export default function HomeScreen() {
  return (
    <ScrollScreenWrapper disableBottomPadding contentContainerClassName="grow">
      <TripMap />
    </ScrollScreenWrapper>
  );
}
