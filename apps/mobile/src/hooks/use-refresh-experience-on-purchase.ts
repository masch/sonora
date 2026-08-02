import { useEffect, useRef } from 'react';

import type { PurchaseStatus } from '@/hooks/use-purchase';

/**
 * When a purchase resolves to 'purchased' but the fetched experience predates
 * the payment (no signed audioUrl), ask the parent to re-fetch so the backend
 * can include the audio link now that access is granted.
 *
 * Fires at most once per mounted instance (the parent remounts the view per
 * experience via `key={track.id}`, so the guard does not leak between tracks).
 */
export function useRefreshExperienceOnPurchase(
  status: PurchaseStatus,
  hasAudioUrl: boolean,
  onPurchased?: () => void,
): void {
  const firedRef = useRef(false);

  useEffect(() => {
    if (status === 'purchased' && !hasAudioUrl && onPurchased && !firedRef.current) {
      firedRef.current = true;
      onPurchased();
    }
  }, [status, hasAudioUrl, onPurchased]);
}
