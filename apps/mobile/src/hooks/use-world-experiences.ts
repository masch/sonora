import { useCallback, useEffect, useState } from 'react';

import {
  fetchExperiences,
  isPlayableExperience,
  type PlayableExperience,
} from '@/data/experiences';
import { logger } from '@/utils/logger';

export interface WorldExperiencesState {
  status: 'loading' | 'ready' | 'error';
  /** The experiences the world draws: published ones the app can open. */
  experiences: PlayableExperience[];
  /** Starts the fetch over; the world shows it when the first one failed. */
  retry: () => void;
}

/**
 * The experiences the world draws, from the payload the lists already read.
 *
 * No new endpoint and no seeded document: `/experiences` already carries the
 * point, the title, the duration and the price of every published experience, so
 * the world is a projection of that list rather than a second source of truth.
 *
 * An experience the app cannot open is not a point: a `general-feedback` entry is
 * not a place, and a tap on it would ask for a detail screen that does not exist
 * for it. The filter is the payload's own rule (`isPlayableExperience`), not a
 * second one written here.
 */
export function useWorldExperiences(): WorldExperiencesState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    attempt: number;
    status: 'loading' | 'ready' | 'error';
    experiences: PlayableExperience[];
  }>({ attempt: 0, status: 'loading', experiences: [] });

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    let active = true;

    // No loading state is written here: the attempt id already says which run a
    // settled result belongs to, so a run that has not settled yet *is* the loading
    // one. Writing it synchronously here would be a cascading render for a fact the
    // render can derive (`settled` below).
    fetchExperiences()
      .then((list) => {
        if (!active) return;
        setState({
          attempt,
          status: 'ready',
          experiences: list.filter(isPlayableExperience),
        });
      })
      .catch((error: unknown) => {
        // The world never shows a request's words: the screen says it failed and
        // offers the retry, and the detail stays in the log.
        logger.error('The Deriva world could not load its experiences:', error);
        if (active) setState({ attempt, status: 'error', experiences: [] });
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  // A settled result belongs to the attempt that produced it: the retry shows its
  // own loading state instead of the failure of the run that was given up.
  const settled = state.attempt === attempt;
  return {
    status: settled ? state.status : 'loading',
    experiences: settled ? state.experiences : [],
    retry,
  };
}
