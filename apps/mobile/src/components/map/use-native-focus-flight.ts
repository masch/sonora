import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useRef } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

/** How close the camera must end to the requested center to count as an arrival, in
 * degrees: about ten meters, which absorbs a reported viewport's rounding. */
const ARRIVAL_EPSILON_DEGREES = 1e-4;

/** The slice of `MapRef` a native flight reads: where the camera is, in zoom. */
export interface NativeFlightMap {
  getZoom(): Promise<number>;
}

/** The slice of `CameraRef` a native flight uses: the one imperative move. */
export interface NativeFlightCamera {
  flyTo(options: {
    center: [number, number];
    duration?: number;
    zoom?: number;
    easing?: 'fly';
  }): void;
}

export interface NativeFocusFlightOptions {
  focus: { latitude: number; longitude: number } | null | undefined;
  mapRef: { readonly current: NativeFlightMap | null };
  cameraRef: { readonly current: NativeFlightCamera | null };
  /** Called once per flight, when the camera it asked for comes to rest. */
  onSettled: (() => void) | undefined;
  durationMs: number;
  minZoom: number;
}

/**
 * Travels to the place the caller asked for, and reports the landing.
 *
 * The camera stays declarative for its opening frame (`bounds` or `center`); this is
 * the one imperative move, because a tapped point is a destination the walker chose
 * and the map should follow it instead of being rebuilt around it.
 *
 * It lives outside the renderer for the same reason the web flight does: it is a
 * decision about the camera, not about drawing, and both platforms then read as the
 * same two steps — travel, and say when you arrived.
 *
 * The zoom is asked for and not assumed: the camera has to end up as close as
 * `minZoom` even when the world was opened further out, which is the one thing a
 * flight without `zoom` cannot do — it keeps what the map had, and a point tapped
 * from the opening frame would stay a pixel among crowded labels. `getZoom()` is
 * asynchronous, so the move is guarded: a focus replaced while the answer is in
 * flight must not fly to a place the walker stopped asking for. An unavailable zoom
 * still flies, at the floor, because a tap that does nothing is worse than a flight
 * that chooses the close-up.
 *
 * Returns the region-change handler the map must be given. Native maps report every
 * region change, the walker's own pan included, so the returned handler reports only
 * the landing of a flight this hook started — the flight it names is what keeps a pan,
 * and a flight that was replaced before it landed, from opening a card nobody asked
 * for. It is stable, because a new identity per render would re-register the listener
 * on every render. A move is that landing only when it ended where the flight was sent
 * and the walker is not the one who moved it; a move that does not match leaves the
 * flight armed, because it is still on its way.
 */
export function useNativeFocusFlight({
  focus,
  mapRef,
  cameraRef,
  onSettled,
  durationMs,
  minZoom,
}: NativeFocusFlightOptions): (event: NativeSyntheticEvent<ViewStateChangeEvent>) => void {
  /**
   * The flight whose landing is still awaited, by number, or `null` when none is.
   *
   * A number and not a flag: a region change carries no identity of its own, so the only
   * way to keep the flight that was replaced from reporting is to disarm it the moment
   * it is replaced — the next effect run does that before it awaits anything — and to
   * arm nothing but the flight that really asked the camera to move. It travels with
   * where the flight was sent, which is what makes a report its arrival.
   */
  const awaitingRef = useRef<{ flight: number; center: [number, number] } | null>(null);
  /** The last number handed out. Monotonic for the life of the component. */
  const flightsRef = useRef(0);
  /**
   * Read through a ref: the caller rebuilds the callback on every render, and a new
   * identity must neither re-arm the flag nor report a landing twice.
   */
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  const longitude = focus?.longitude;
  const latitude = focus?.latitude;

  useEffect(() => {
    // Whatever was in the air is replaced: its landing, whenever the map reports it, is
    // no longer anybody's to report. Set before the zoom is asked for, so the region
    // change of the interrupted flight cannot be read as the landing of this one.
    awaitingRef.current = null;

    if (longitude === undefined || latitude === undefined) {
      // The request was withdrawn before it landed: the next region change belongs
      // to the walker, and reporting it would open a card nobody asked for.
      return;
    }

    const flight = flightsRef.current + 1;
    flightsRef.current = flight;
    let cancelled = false;
    void (async () => {
      const currentZoom = await mapRef.current?.getZoom();
      if (cancelled) return;
      const camera = cameraRef.current;
      if (!camera) return;
      // Armed right before the move, so the region change that follows is recognised
      // as this flight's landing instead of as a pan the walker made.
      awaitingRef.current = { flight, center: [longitude, latitude] };
      camera.flyTo({
        center: [longitude, latitude],
        duration: durationMs,
        zoom: Math.max(currentZoom ?? minZoom, minZoom),
        easing: 'fly',
      });
    })();

    return () => {
      cancelled = true;
      // Replaced or unmounted: this flight can no longer report, and the flag it armed
      // must not survive as the answer to a region change it never made.
      if (awaitingRef.current?.flight === flight) awaitingRef.current = null;
    };
  }, [mapRef, cameraRef, longitude, latitude, durationMs, minZoom]);

  return useCallback((event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const awaiting = awaitingRef.current;
    if (!awaiting) return;

    const [longitude, latitude] = event.nativeEvent.center;
    // Where the camera came to rest is the test, not who moved it.
    //
    // `userInteraction` was the tempting discriminator and it is the wrong one: whether
    // the platform reports a programmatic `flyTo` landing as an interaction is a
    // question about MapLibre's native implementations, not about this hook, and it
    // cannot be answered from here. Position can: a move that ends anywhere else is not
    // this flight's arrival — a walker's pan, or the delayed change of a flight a second
    // tap replaced — and it is not a reason to disarm, because the flight is still on
    // its way. A move that ends at the requested centre is an arrival whoever drove it,
    // and reporting it then is right: the camera really is there.
    if (Math.abs(longitude - awaiting.center[0]) > ARRIVAL_EPSILON_DEGREES) return;
    if (Math.abs(latitude - awaiting.center[1]) > ARRIVAL_EPSILON_DEGREES) return;

    awaitingRef.current = null;
    onSettledRef.current?.();
  }, []);
}
