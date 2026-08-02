import { APP_CONFIG } from '@/config/app-config';
import {
  type Experience,
  type PlayableExperience,
  fetchExperiences,
  isPlayableExperience,
  INSTRUCTIONS_SLUG,
  INSTRUCTIONS_FALLBACK_TRACK_ID,
} from '@/data/experiences';
import { useEffect, useState } from 'react';

export interface UseInstructionsAudioResult {
  /** Resolved audio URL — from the API instructions trip, or APP_CONFIG fallback */
  audioUrl: string | null;
  /** Resolved track ID — the trip UUID, or 'instructions' fallback */
  trackId: string;
  /** Loading while the experiences fetch is in-flight */
  loading: boolean;
  /** Error state when both API and fallback fail */
  error: Error | null;
}

/**
 * Hook that resolves the instructions audio URL from the Experiences API.
 *
 * On mount, fetches all experiences and finds the one with `slug === INSTRUCTIONS_SLUG`
 * and `format === 'trip'`. Falls back to `APP_CONFIG.audio.instructionsUrl` and
 * `INSTRUCTIONS_FALLBACK_TRACK_ID` when the API fetch fails or the trip is not found.
 */
export function useInstructionsAudio(): UseInstructionsAudioResult {
  const [experiences, setExperiences] = useState<Experience[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchExperiences(controller.signal)
      .then((data) => {
        if (!cancelled) {
          setExperiences(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Derived value: React Compiler memoizes it automatically, no manual useMemo needed.
  const found = experiences?.find((exp) => exp.slug === INSTRUCTIONS_SLUG && exp.format === 'trip');
  const instructionsTrip: PlayableExperience | null =
    found && isPlayableExperience(found) ? found : null;

  return {
    audioUrl: instructionsTrip?.audioUrl ?? APP_CONFIG.audio.instructionsUrl,
    trackId: instructionsTrip?.id ?? INSTRUCTIONS_FALLBACK_TRACK_ID,
    loading,
    error: !instructionsTrip && error ? error : null,
  };
}
