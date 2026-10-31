import { useEffect } from 'react';

/**
 * The options MapLibre's `flyTo` takes, narrowed to what a flight decides.
 *
 * One object, because that is the API: `flyTo(options)`, never `flyTo(center, options)`.
 * The narrower type is deliberate — a flight decides where to, how long and how close —
 * and it is what makes the call impossible to get wrong without the type complaining.
 */
export interface FocusFlightOptions {
  center: [number, number];
  duration?: number;
  zoom?: number;
}

/** The slice of a MapLibre map a flight needs. Nothing else is touched. */
export interface FocusFlightMap {
  flyTo(options: FocusFlightOptions): void;
  getZoom(): number;
}

/**
 * Travels to a place the caller asked the camera to reach, and does nothing else.
 *
 * Deliberately not `center`: on both renderers that is an input of the map's own
 * creation, so changing it rebuilds the map — a new style, new tiles, a flash the
 * walker sees — while a flight only moves the camera. This lives outside the
 * renderer because it is a decision about the camera, not about drawing, and both
 * renderers would otherwise carry the same effect with a different call inside.
 *
 * The zoom never drops below `minZoom` (judged against where the map already is,
 * so a closer view is left alone): a point has to land as a place, not as a pixel.
 */
export function useMapFocusFlight(
  mapRef: { readonly current: FocusFlightMap | null },
  ready: boolean,
  focus: { latitude: number; longitude: number } | null | undefined,
  durationMs: number,
  minZoom: number,
): void {
  const longitude = focus?.longitude;
  const latitude = focus?.latitude;

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (longitude === undefined || latitude === undefined) return;
    map.flyTo({
      center: [longitude, latitude],
      duration: durationMs,
      zoom: Math.max(map.getZoom(), minZoom),
    });
  }, [mapRef, ready, longitude, latitude, durationMs, minZoom]);
}
