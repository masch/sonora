import TrackDetailMap from '@/components/track-detail-map';
import { TwView } from '@/tw';

import type { ExperienceMapProps } from './map-view.types';

/**
 * Native map facade.
 *
 * Until the native MapLibre map exists (it needs its own dev build), native keeps
 * rendering the Leaflet map in a WebView. The facade exists so screens import one
 * component and Metro resolves the platform: this file on native, the MapLibre one
 * on web. Both take the same props, so switching later touches no screen.
 *
 * Native draws the Leaflet set only: the origin, the numbered waypoints, the
 * walker position and the labels. It deliberately does NOT draw the reference
 * documents (`overlays`) or report taps (`onFeaturePress`) — that arrives with
 * the native MapLibre map (task T4b). Those two props are accepted for the shared
 * contract and intentionally unused here until then.
 */
export default function ExperienceMap({
  center = [-64.738, -32.212],
  userCoordinates,
  waypoints,
  showLabels = true,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: ExperienceMapProps) {
  // Asking for the new renderer on native still draws the map we have: there is no
  // native MapLibre implementation yet, and an empty view would be worse.
  const [longitude, latitude] = center;

  return (
    <TwView testID={testID} className={className}>
      <TrackDetailMap
        latitude={latitude}
        longitude={longitude}
        userLatitude={userCoordinates?.latitude}
        userLongitude={userCoordinates?.longitude}
        showLabels={showLabels}
        waypoints={waypoints}
      />
    </TwView>
  );
}
