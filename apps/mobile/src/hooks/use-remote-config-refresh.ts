import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRemoteConfigStore } from '@/store/remote-config-store';

/**
 * How long a foreground return waits before the config is asked for again.
 *
 * The floor exists because the event it listens to is cheap and frequent: a
 * walker checking a notification, the screen waking up, a permission dialog
 * closing. None of those can publish a new map version, so one minute is short
 * enough to pick a publication up on the next real return to the app and long
 * enough that a switch back and forth is not an API call.
 */
export const FOREGROUND_REVALIDATE_FLOOR_MS = 60_000;

/**
 * Revalidates the remote config when the app comes back to the foreground.
 *
 * The startup effect in the root layout runs once per JS process, so a phone
 * that keeps the app in memory never fetched `/config` again: a map version
 * published while the app lived in the background stayed invisible until the
 * app data was cleared. The process is alive but the payload is old, and this is
 * the moment it can be refreshed — the walker is back, and the store renders
 * from cache while the request is in flight.
 */
export function useRemoteConfigRefresh(): void {
  const lastAttemptAtRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      const now = Date.now();
      const lastAttemptAt = lastAttemptAtRef.current;
      if (lastAttemptAt !== null && now - lastAttemptAt < FOREGROUND_REVALIDATE_FLOOR_MS) {
        return;
      }

      // Stamped only when a run really started. A call the store dropped bought nothing,
      // and charging it would keep the walker's next return from asking at all; a run that
      // started and then failed still counts, or a phone with no signal would ask again on
      // every single app switch.
      if (useRemoteConfigStore.getState().refetch()) {
        lastAttemptAtRef.current = now;
      }
    });

    return () => subscription.remove();
  }, []);
}
