import { useCallback, useEffect, useRef } from 'react';

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
 * the landing of a flight this hook started — the flag is what keeps a pan from
 * opening a card nobody asked for. It is stable, because a new identity per render
 * would re-register the listener on every render.
 */
export function useNativeFocusFlight({
  focus,
  mapRef,
  cameraRef,
  onSettled,
  durationMs,
  minZoom,
}: NativeFocusFlightOptions): () => void {
  /** A flight this hook started has not reported its landing yet. */
  const pendingRef = useRef(false);
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
    if (longitude === undefined || latitude === undefined) {
      // The request was withdrawn before it landed: the next region change belongs
      // to the walker, and reporting it would open a card nobody asked for.
      pendingRef.current = false;
      return;
    }

    let cancelled = false;
    void (async () => {
      const currentZoom = await mapRef.current?.getZoom();
      if (cancelled) return;
      const camera = cameraRef.current;
      if (!camera) return;
      // Set right before the move, so the region change that follows is recognised
      // as this flight's landing instead of as a pan the walker made.
      pendingRef.current = true;
      camera.flyTo({
        center: [longitude, latitude],
        duration: durationMs,
        zoom: Math.max(currentZoom ?? minZoom, minZoom),
        easing: 'fly',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [mapRef, cameraRef, longitude, latitude, durationMs, minZoom]);

  return useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    onSettledRef.current?.();
  }, []);
}
