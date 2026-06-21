import { useState } from 'react';
import type { LocalTrackMetadata } from '@/data/experiences';

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
 * Reads the track's `feedbackTrigger` field and wires the appropriate source.
 *
 * - `audio_end`: triggers when `didJustFinish` transitions to true
 * - `geofence`: triggers when `isNearStart` transitions to true
 * - `manual`: always returns false — the view renders a button that
 *   manages its own show state for this mode
 * - undefined: never triggers
 */
export function useFeedbackTrigger(
  track: LocalTrackMetadata | undefined,
  sources: FeedbackTriggerSources,
): FeedbackTriggerResult {
  const [showFeedback, setShowFeedback] = useState(false);
  const [prevDidJustFinish, setPrevDidJustFinish] = useState(sources.didJustFinish ?? false);
  const [prevIsNearStart, setPrevIsNearStart] = useState(sources.isNearStart ?? false);

  const triggerMode = track?.feedbackTrigger;

  const currentDidJustFinish = sources.didJustFinish ?? false;
  if (currentDidJustFinish !== prevDidJustFinish) {
    setPrevDidJustFinish(currentDidJustFinish);
    if (triggerMode === 'audio_end' && currentDidJustFinish) {
      setShowFeedback(true);
    }
  }

  const currentIsNearStart = sources.isNearStart ?? false;
  if (currentIsNearStart !== prevIsNearStart) {
    setPrevIsNearStart(currentIsNearStart);
    if (triggerMode === 'geofence' && currentIsNearStart) {
      setShowFeedback(true);
    }
  }

  const dismiss = () => {
    setShowFeedback(false);
  };

  return { showFeedback, dismiss };
}
