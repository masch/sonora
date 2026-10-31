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
 *
 * Every flight numbers itself, and the landing is reported by the number: two focuses
 * in a row leave two listeners on one map, and MapLibre reports a camera move to all of
 * them, so a listener may only answer for the flight it belongs to.
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
  /**
   * The flight whose landing is still awaited, by number, or `null` when none is.
   *
   * A number rather than a flag, because a flag cannot tell one flight's landing from
   * another's: a listener registered for a flight that was replaced would find it `true`
   * and report a camera move it never asked for.
   */
  const awaitingRef = useRef<number | null>(null);
  /** The last number handed out. Monotonic for the life of the component. */
  const flightsRef = useRef(0);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  // A landing nobody waits for must stay inert: the map is removed with the
  // component, which drops the listener, and this keeps the moment in between from
  // reporting a flight the caller had already abandoned.
  useEffect(
    () => () => {
      awaitingRef.current = null;
    },
    [],
  );

  useEffect(() => {
    // Whatever was in the air is replaced, and its landing is no longer anybody's to
    // report — including the landing MapLibre emits below, when this flight cuts that
    // move off in the middle.
    awaitingRef.current = null;

    const map = mapRef.current;
    if (!ready || !map) return;
    if (longitude === undefined || latitude === undefined) {
      // The request was withdrawn before it landed: whatever move ends next is the
      // walker's, not the flight this hook started.
      return;
    }

    const flight = flightsRef.current + 1;
    flightsRef.current = flight;

    map.flyTo({
      center: [longitude, latitude],
      duration: durationMs,
      zoom: Math.max(map.getZoom(), minZoom),
    });

    if (!map.once) return;
    // Armed after the move and not before, which is the opposite of the obvious order
    // and is what makes a replaced flight survivable: `flyTo` stops the move in progress,
    // and stopping it reports the landing of the transition it just cut off. That report
    // reaches every listener registered at that moment — a listener registered for this
    // flight included — and `once` would spend it on a landing this flight did not make.
    // The cost of arming afterwards is a flight that ends inside the call itself (a zero
    // duration), which reports nothing and is covered by the caller's own bound.
    awaitingRef.current = flight;
    map.once('moveend', () => {
      if (awaitingRef.current !== flight) return;
      awaitingRef.current = null;
      onSettledRef.current?.();
    });
  }, [mapRef, ready, longitude, latitude, durationMs, minZoom]);
}
