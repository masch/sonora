import { useCallback, useEffect, useRef, useState } from 'react';

import { FOCUS_SETTLE_FALLBACK_MS } from './map-view.types';

/**
 * One tap's flight to the point it chose, and the card it opens on landing.
 *
 * Variant B travels to the point before the card opens, so a tap cannot open it
 * directly: the request is the destination the camera is flying to, and `id` makes
 * every tap a new request even when it names the place the previous one did —
 * otherwise tapping the same point twice would look like no change and never open
 * again. The card opens when the camera reports that the move came to rest, with a
 * dead-man fallback for a renderer that never reports, which is longer than any
 * flight and so can never race the camera.
 *
 * Living here so `WorldMap` stays at the size the doctor gate allows.
 */
export function useWorldFlight(onLanded: (slug: string) => void): {
  flight: { slug: string; id: number } | null;
  beginFlight: (slug: string) => void;
  landFlight: () => void;
  cancelFlight: () => void;
} {
  const [flight, setFlight] = useState<{ slug: string; id: number } | null>(null);
  const requestId = useRef(0);

  const beginFlight = useCallback((slug: string) => {
    requestId.current += 1;
    setFlight({ slug, id: requestId.current });
  }, []);

  const landFlight = useCallback(() => {
    setFlight((current) => {
      if (current) onLanded(current.slug);
      return null;
    });
  }, [onLanded]);

  /**
   * The dead-man fallback, and the only timer here: a renderer that never reports
   * would otherwise eat the tap.
   */
  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(landFlight, FOCUS_SETTLE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [flight, landFlight]);

  const cancelFlight = useCallback(() => setFlight(null), []);

  return { flight, beginFlight, landFlight, cancelFlight };
}
