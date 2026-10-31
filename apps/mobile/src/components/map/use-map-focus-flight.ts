import { useEffect } from 'react';

/** The slice of a MapLibre map a flight needs. Nothing else is touched. */
export interface FocusFlightMap {
  flyTo(center: [number, number], options?: unknown): void;
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
    map.flyTo([longitude, latitude], {
      duration: durationMs,
      zoom: Math.max(map.getZoom(), minZoom),
    });
  }, [mapRef, ready, longitude, latitude, durationMs, minZoom]);
}
