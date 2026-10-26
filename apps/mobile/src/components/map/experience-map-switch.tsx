import { useState } from 'react';

import { ITINERARY_DOCUMENT_KEY, itineraryDocument, type MapDocument } from '@sonora/shared';

import TrackDetailMap from '@/components/track-detail-map';
import ReferenceCard from '@/components/reference-card';
import { IconButton } from '@/components/ui/icon-button';
import type { PlayableExperience } from '@/data/experiences';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';

import ExperienceMap from './experience-map';
import type { MapReferencePress, MapSourceConfig } from './map-view.types';
import type { MapRenderer } from './resolve-renderer';

/**
 * The map's own frame, the same wherever the map is mounted.
 *
 * The map bleeds to the edges of the card it lives in, with no strip of card around
 * it, and the surface still owns its box: one width, one height, one rounding. The
 * one assumption left — the card's gutter — is a constant the cards read too, so the
 * cancellation cannot drift out of step.
 */
/**
 * The horizontal padding a detail card gives its content.
 *
 * The map bleeds to the card's edges, so the surface nulls exactly this padding and
 * nothing else. One constant feeds both the card and the negative margin: a card
 * that padded a different step used to leave a strip of itself around the map, and
 * that is what two magic numbers in two files produced.
 */
export const MAP_CARD_GUTTER_CLASS = 'px-4';

const SURFACE_CLASS = `relative w-full h-80 -mx-4 overflow-hidden rounded-xl`;

export interface ExperienceMapSwitchProps {
  renderer: MapRenderer;
  source: MapSourceConfig;
  experience: PlayableExperience;
  userCoordinates?: { latitude: number; longitude: number };
  testID?: string;
}

/** Trips carry waypoints; tracks are a single origin. */
function waypointsOf(experience: PlayableExperience) {
  return 'waypoints' in experience ? experience.waypoints : [];
}

/**
 * The map for an experience, whichever implementation is enabled, together with
 * its controls.
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
 *
 * The labels control is defined here and nowhere else, so every screen that
 * mounts a map shows it the same way: the screen says which experience and which
 * frame, and the frame is the same everywhere: which controls a map has must not
 * depend on where it is mounted.
 */
export default function ExperienceMapSwitch({
  renderer,
  source,
  experience,
  userCoordinates,
  testID,
}: ExperienceMapSwitchProps) {
  const { t } = useAppTranslation();
  const waypoints = waypointsOf(experience);
  const [pressedReference, setPressedReference] = useState<MapReferencePress | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  function handleFeaturePress(reference: MapReferencePress) {
    if (reference.documentKey === ITINERARY_DOCUMENT_KEY) return;
    setPressedReference(reference);
  }

  function drawMap() {
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
            className="h-full w-full"
            source={source}
            overlays={overlays}
            center={[experience.longitude, experience.latitude]}
            userCoordinates={userCoordinates}
            waypoints={waypoints}
            showLabels={showLabels}
            onFeaturePress={handleFeaturePress}
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

  return (
    <TwView className={SURFACE_CLASS} testID={testID}>
      {drawMap()}
      <IconButton
        onPress={() => setShowLabels(!showLabels)}
        variant="outline"
        size="sm"
        className="absolute top-3 right-3 bg-white/95 dark:bg-zinc-800/95 shadow-md z-20 border-0"
        accessibilityLabel={showLabels ? t('map.hideLabels') : t('map.showLabels')}
        testID="toggle-map-labels"
        icon={{
          ios: showLabels ? 'tag.slash.fill' : 'tag.fill',
          android: showLabels ? 'label_off' : 'label',
          web: showLabels ? 'label_off' : 'label',
        }}
      />
    </TwView>
  );
}
