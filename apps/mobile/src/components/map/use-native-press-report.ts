import { useCallback } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import type {
  MapRef,
  PixelPointBounds,
  PressEvent,
  PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';

import { documentKeyOfLayer, type MapReferencePress } from './map-view.types';
import { logger } from '@/utils/logger';

/** Press target around the tapped point, in pixels: the 44x44 a pressable source uses. */
const HITBOX_PIXELS = 22;

/**
 * Reads a reportable reference out of a tapped feature. The web renderer has the
 * same mapping (`toPressReference` in `experience-map.web.tsx`, fed by
 * `feature.layer.id`); native presses carry no layer id, so the layer that was
 * queried stands in for it and both builds emit the same `MapReferencePress`.
 */
function toPressReference(
  layerId: string,
  properties: Record<string, unknown>,
): MapReferencePress | null {
  const documentKey = documentKeyOfLayer(layerId);
  if (!documentKey) return null;

  const reference: MapReferencePress = { documentKey };
  if (typeof properties.experienceSlug === 'string') {
    reference.experienceSlug = properties.experienceSlug;
  }
  if (typeof properties.labelText === 'string') reference.labelText = properties.labelText;
  if (typeof properties.labelKey === 'string') reference.labelKey = properties.labelKey;
  if (typeof properties.descriptionText === 'string') {
    reference.descriptionText = properties.descriptionText;
  }
  if (typeof properties.descriptionKey === 'string') {
    reference.descriptionKey = properties.descriptionKey;
  }
  if (typeof properties.imageUrl === 'string') reference.imageUrl = properties.imageUrl;
  if (typeof properties.linkUrl === 'string') reference.linkUrl = properties.linkUrl;
  return reference;
}

/**
 * Reports the tapped reference to the caller. A native press carries no layer id, so
 * the hit test is asked once per reference layer, topmost first (the layer drawn last
 * covers the ones below it), over the same 44x44 target a pressable source uses.
 *
 * A hit on a clustered source's aggregate layer reports the aggregate's centre: a
 * cluster names no experience, and the caller decides what a tap on it means.
 */
export function useNativePressReport(
  onFeaturePress: ((reference: MapReferencePress) => void) | undefined,
  referenceLayerIds: readonly string[],
  mapRef: { current: MapRef | null },
): (event: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>) => Promise<void> {
  return useCallback(
    async (event: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>): Promise<void> => {
      const handler = onFeaturePress;
      const map = mapRef.current;
      if (!handler || !map) return;

      const [x, y] = event.nativeEvent.point;
      const target: PixelPointBounds = [
        [x - HITBOX_PIXELS, y - HITBOX_PIXELS],
        [x + HITBOX_PIXELS, y + HITBOX_PIXELS],
      ];

      for (const layerId of [...referenceLayerIds].reverse()) {
        let features: { properties?: Record<string, unknown> | null }[];
        try {
          features = await map.queryRenderedFeatures(target, { layers: [layerId] });
        } catch (error) {
          logger.error('ExperienceMap could not query the pressed layers:', error);
          return;
        }

        const hit = features[0];
        if (!hit) continue;

        const hitProperties = (hit.properties ?? {}) as Record<string, unknown>;
        // A cluster is an aggregate, not a place: it names no experience, so the
        // reference carries its centre and the caller decides what a tap on it means.
        if (typeof hitProperties.point_count === 'number') {
          const geometry = (
            hit as unknown as {
              geometry?: { coordinates?: [number, number] };
            }
          ).geometry;
          const [longitude, latitude] = geometry?.coordinates ?? [];
          if (typeof longitude === 'number' && typeof latitude === 'number') {
            handler({
              documentKey: documentKeyOfLayer(layerId) ?? '',
              cluster: { longitude, latitude },
            });
          }
          return;
        }

        const reference = toPressReference(layerId, hitProperties);
        if (reference) handler(reference);
        return;
      }
    },
    [onFeaturePress, referenceLayerIds, mapRef],
  );
}
