import { useEffect, useRef } from 'react';

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
  /**
   * One report for the next camera move to end, then gone.
   *
   * Optional because reporting is not what a flight needs: a map that cannot say
   * when it came to rest still travels, and the caller's own bound covers the
   * silence. `once` and not `on`, because a flight is one move — MapLibre reports
   * every move, the walker's own pan included, and only the requested one is a
   * landing worth reporting.
   */
  once?(event: 'moveend', handler: () => void): void;
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
 *
 * `onSettled` is called when a flight this hook started comes to rest, which is what
 * lets a caller sequence UI on the camera rather than on `durationMs`. It is
 * extended here and not in the renderer because only this effect knows whether a
 * flight really started: a map that was not ready never asked the camera for
 * anything, so there is nothing to report.
 */
export function useMapFocusFlight(
  mapRef: { readonly current: FocusFlightMap | null },
  ready: boolean,
  focus: { latitude: number; longitude: number } | null | undefined,
  durationMs: number,
  minZoom: number,
  onSettled?: () => void,
): void {
  const longitude = focus?.longitude;
  const latitude = focus?.latitude;

  /**
   * Read through a ref: the caller rebuilds the callback on every render, and a new
   * identity must neither re-register the listener nor fly the camera again.
   */
  const onSettledRef = useRef(onSettled);
  /** A flight this hook started is in the air: the next landing is its own. */
  const pendingRef = useRef(false);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  // A landing nobody waits for must stay inert: the map is removed with the
  // component, which drops the listener, and this keeps the moment in between from
  // reporting a flight the caller had already abandoned.
  useEffect(
    () => () => {
      pendingRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (longitude === undefined || latitude === undefined) {
      // The request was withdrawn before it landed: whatever move ends next is the
      // walker's, not the flight this hook started.
      pendingRef.current = false;
      return;
    }

    if (map.once) {
      // Registered before the move, so a flight that ends as soon as it starts still
      // reports its landing.
      pendingRef.current = true;
      map.once('moveend', () => {
        if (!pendingRef.current) return;
        pendingRef.current = false;
        onSettledRef.current?.();
      });
    }

    map.flyTo({
      center: [longitude, latitude],
      duration: durationMs,
      zoom: Math.max(map.getZoom(), minZoom),
    });
  }, [mapRef, ready, longitude, latitude, durationMs, minZoom]);
}
