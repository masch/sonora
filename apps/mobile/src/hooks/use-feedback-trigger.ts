import { useState, useEffect, useRef, useCallback } from 'react';
import type { LocalTripMetadata } from '@/data/trips';

export interface FeedbackTriggerSources {
  /** From useImmersionPlayer: true when audio playback just finished */
  didJustFinish?: boolean;
  /** From useOfflineGeofence: true when GPS detects arrival */
  isNearStart?: boolean;
}

export interface FeedbackTriggerResult {
  /** Whether the feedback form should be shown */
  showFeedback: boolean;
  /** Call to dismiss/hide the feedback form */
  dismiss: () => void;
}

/**
 * Reads the trip's `feedbackTrigger` field and wires the appropriate source.
 *
 * - `audio_end`: triggers when `didJustFinish` transitions to true
 * - `geofence`: triggers when `isNearStart` transitions to true
 * - `manual`: always returns false — the view renders a button that
 *   manages its own show state for this mode
 * - undefined: never triggers
 */
export function useFeedbackTrigger(
  trip: LocalTripMetadata | undefined,
  sources: FeedbackTriggerSources,
): FeedbackTriggerResult {
  const [showFeedback, setShowFeedback] = useState(false);
  const prevDidJustFinish = useRef(sources.didJustFinish ?? false);
  const prevIsNearStart = useRef(sources.isNearStart ?? false);

  const triggerMode = trip?.feedbackTrigger;

  useEffect(() => {
    if (!triggerMode || triggerMode === 'manual') {
      // No auto-trigger for undefined or manual mode (state already false by default)
      return;
    }

    if (triggerMode === 'audio_end') {
      const current = sources.didJustFinish ?? false;
      const prev = prevDidJustFinish.current;
      prevDidJustFinish.current = current;

      // Trigger on transition from false→true (edge-triggered)
      if (current && !prev) {
        setShowFeedback(true);
      }
    }

    if (triggerMode === 'geofence') {
      const current = sources.isNearStart ?? false;
      const prev = prevIsNearStart.current;
      prevIsNearStart.current = current;

      // Trigger on transition from false→true (edge-triggered)
      if (current && !prev) {
        setShowFeedback(true);
      }
    }
  }, [triggerMode, sources.didJustFinish, sources.isNearStart]);

  const dismiss = useCallback(() => {
    setShowFeedback(false);
  }, []);

  return { showFeedback, dismiss };
}
