import TripDetailView from '@/components/trip-detail-view';

// Walk tab — dedicated tab pointing to the Umepay Bosque trip detail.
// Uses the same TripDetailView component as trips/[id].tsx.
export default function WalkTab() {
  return <TripDetailView tripId="umepay-bosque" />;
}
