import type { RefObject } from 'react';
import { useEffect } from 'react';

import type { UserLocationCoordinates } from '@sonora/shared';

import { useAppTranslation } from '@/hooks/use-translation';

import { applyUserLocation } from './apply-user-location';
import type { MapHandle } from './use-web-map-instance';

export interface UseUserLocationOptions {
  mapRef: RefObject<MapHandle | null>;
  /** A map that has not drawn yet has no style to add a source to. */
  ready: boolean;
  coordinates: UserLocationCoordinates | undefined;
  /** The walker's own name goes with the labels they switched off. */
  showLabels: boolean;
  /**
   * Whether the style published a glyphs source, read from the hook that built it.
   *
   * Read here, inside the effect, and never during render: it is only known once the
   * map is drawn.
   */
  glyphsAvailableRef: RefObject<boolean>;
}

/**
 * Keeps the web map's walker point where the device says the walker is.
 *
 * A hook rather than a block inside the renderer for the same reason the native side is
 * a component: the renderer is the longest module in this directory, and this decision
 * has nothing to do with the documents, the waits or the camera it already owns.
 */
export function useUserLocation({
  mapRef,
  ready,
  coordinates,
  showLabels,
  glyphsAvailableRef,
}: UseUserLocationOptions): void {
  const { t } = useAppTranslation();
  /**
   * The label as a string, not as the hook's identity: the translation hook hands a new
   * `t` on every render, and this effect must depend on the text it actually draws.
   */
  const label = showLabels ? t('map.userLocation') : undefined;
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    applyUserLocation(
      map,
      latitude === undefined || longitude === undefined ? null : { latitude, longitude },
      { label, includeLabel: label !== undefined && glyphsAvailableRef.current === true },
    );
  }, [ready, latitude, longitude, label, glyphsAvailableRef, mapRef]);
}
