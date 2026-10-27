import { useState } from 'react';

import {
  ITINERARY_DOCUMENT_KEY,
  MAPLIBRE_LAYER_CAPABILITIES,
  itineraryDocument,
  resolveLayerSelection,
  showLayerControl,
  type MapDocument,
  type MapLayerGroupId,
  type MapLayerSelection,
} from '@sonora/shared';

import TrackDetailMap from '@/components/track-detail-map';
import ReferenceCard from '@/components/reference-card';
import { IconButton } from '@/components/ui/icon-button';
import type { PlayableExperience } from '@/data/experiences';
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';

import ExperienceMap from './experience-map';
import MapLayersControl from './map-layers-control';
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
 * The horizontal gutter a detail card gives its content, and the margin that nulls it.
 *
 * Both live here, as literals, because NativeWind only generates a utility it can read
 * as a static class — a value computed at runtime would style nothing. The pair is the
 * contract: the map bleeds to the card's edges exactly to the step the card pads, and
 * a test reads both numbers and fails when they stop agreeing.
 */
export const MAP_CARD_GUTTER_CLASS = 'px-4';
export const MAP_SURFACE_BLEED_CLASS = '-mx-4';

// A complete literal on purpose: NativeWind generates a utility only from a class it
// can read statically, so the surface cannot be assembled from pieces at runtime. The
// test keeps this literal equal to the constant above.
//
// Deliberately no width: a width of 100% does not stretch under a negative margin — it
// shifts the box and leaves the same width, which showed as a strip of card on the
// right on web. Without a width the surface stretches to the parent and the negative
// margin is what makes it reach both edges.
const SURFACE_CLASS = `relative h-80 -mx-4 overflow-hidden rounded-xl`;

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
 *
 * The layer selector is the map's other control, and the selection it edits is
 * decided here too: the switch resolves the payload once, keeps it in state, and
 * hands the result to the renderer, which applies it and resolves nothing. One place
 * decides what the map draws; the renderer only draws it.
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
  /**
   * The groups the payload asks for, resolved against what the renderer can toggle
   * (T3).
   *
   * Recomputed whenever the payload's content changes, never captured at mount: the
   * remote config arrives after the map is already on screen, and a selection frozen
   * at mount would draw the groups a payload never asked for and show the walker
   * checkboxes that disagree with the map.
   */
  const resolvedSelection = resolveLayerSelection(source.layers ?? [], MAPLIBRE_LAYER_CAPABILITIES);

  /**
   * What the walker changed, by group, and only that.
   *
   * Overrides rather than a whole selection: the payload stays the source of truth for
   * every group the walker never touched, so a payload that lands late still reaches
   * the map. Nothing persists these yet, so the choice lasts as long as the mount does.
   */
  const [layerOverrides, setLayerOverrides] = useState<Partial<Record<MapLayerGroupId, boolean>>>(
    {},
  );

  const layerSelection: readonly MapLayerSelection[] = resolvedSelection.map((entry) => {
    const override = layerOverrides[entry.id];
    if (override === undefined) return entry;
    return { ...entry, visible: override, declared: true };
  });

  function handleFeaturePress(reference: MapReferencePress) {
    if (reference.documentKey === ITINERARY_DOCUMENT_KEY) return;
    setPressedReference(reference);
  }

  /**
   * Flips one group, and declares it while doing so.
   *
   * `visible` alone would be a decision `applyLayerGroups` ignores: a group the payload
   * never mentions is left exactly as the style authored it, because silence is not a
   * request. A walker who toggles a row is not silent — they are naming the group — so
   * the entry becomes `declared` and the choice reaches the style. `declared` is only
   * ever raised here, never lowered: it records who spoke, not what they said.
   */
  function handleToggleLayer(id: MapLayerGroupId) {
    const current = layerSelection.find((entry) => entry.id === id);
    const next = !(current?.visible ?? true);
    setLayerOverrides((previous) => ({ ...previous, [id]: next }));
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
            layerSelection={layerSelection}
            overlays={overlays}
            center={[experience.longitude, experience.latitude]}
            userCoordinates={userCoordinates}
            waypoints={waypoints}
            showLabels={showLabels}
            onFeaturePress={handleFeaturePress}
          />
          <MapLayersControl
            selection={layerSelection}
            onToggle={handleToggleLayer}
            allowed={showLayerControl(
              source.showLayersControl ?? false,
              MAPLIBRE_LAYER_CAPABILITIES,
            )}
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
