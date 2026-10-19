import { useState } from 'react';

import { ITINERARY_DOCUMENT_KEY, itineraryDocument, type MapDocument } from '@sonora/shared';

import TrackDetailMap from '@/components/track-detail-map';
import ReferenceCard from '@/components/reference-card';
import type { PlayableExperience } from '@/data/experiences';

import ExperienceMap from './experience-map';
import type { MapReferencePress, MapSourceConfig } from './map-view.types';
import type { MapRenderer } from './resolve-renderer';

export interface ExperienceMapSwitchProps {
  renderer: MapRenderer;
  source: MapSourceConfig;
  experience: PlayableExperience;
  userCoordinates?: { latitude: number; longitude: number };
  /** Draw the map labels: labels toggle on the trip screen. Defaults to true. */
  showLabels?: boolean;
  testID?: string;
}

/** Trips carry waypoints; tracks are a single origin. */
function waypointsOf(experience: PlayableExperience) {
  return 'waypoints' in experience ? experience.waypoints : [];
}

/**
 * The map for an experience, whichever implementation is enabled.
 *
 * Extracted from the track screen so a trip mounts the same renderer. The switch
 * hands the itinerary to whichever branch runs: the origin, the numbered stops
 * and the walker position. MapLibre receives it as the derived itinerary document
 * plus the experience's own references; Leaflet receives the waypoints it already
 * knows how to draw. On native the `ExperienceMap` branch resolves to the Leaflet
 * facade, which draws the itinerary but not the references yet (task T4b).
 *
 * The tapped reference's card belongs to the map that reported the tap, so the
 * state lives here and both screens get it without wiring one of their own.
 *
 * The itinerary this switch injects is drawing, not content: a tap on the origin,
 * a numbered stop, the path or the walker position reports the derived document's
 * key, and that never opens a card.
 */
export default function ExperienceMapSwitch({
  renderer,
  source,
  experience,
  userCoordinates,
  showLabels = true,
  testID,
}: ExperienceMapSwitchProps) {
  const waypoints = waypointsOf(experience);
  const [pressedReference, setPressedReference] = useState<MapReferencePress | null>(null);

  function handleFeaturePress(reference: MapReferencePress) {
    if (reference.documentKey === ITINERARY_DOCUMENT_KEY) return;
    setPressedReference(reference);
  }

  if (renderer === 'maplibre') {
    const itinerary = itineraryDocument({
      origin: { latitude: experience.latitude, longitude: experience.longitude },
      waypoints,
      userCoordinates,
    });
    const overlays: MapDocument[] = [itinerary, ...(experience.mapDocuments ?? [])];

    return (
      <>
        <ExperienceMap
          source={source}
          overlays={overlays}
          center={[experience.longitude, experience.latitude]}
          userCoordinates={userCoordinates}
          waypoints={waypoints}
          showLabels={showLabels}
          onFeaturePress={handleFeaturePress}
          testID={testID}
        />
        <ReferenceCard reference={pressedReference} onDismiss={() => setPressedReference(null)} />
      </>
    );
  }

  return (
    <TrackDetailMap
      latitude={experience.latitude}
      longitude={experience.longitude}
      userLatitude={userCoordinates?.latitude}
      userLongitude={userCoordinates?.longitude}
      showLabels={showLabels}
      waypoints={waypoints}
    />
  );
}
