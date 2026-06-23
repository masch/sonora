import { useState, useEffect, useCallback } from 'react';
import { APP_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';
import { type Experience } from '@/data/experiences';

interface FeedbackServerEntry {
  id: string;
  experienceId: string;
  message: string;
  createdAt: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface FeedState {
  feed: FeedbackServerEntry[];
  experiences: Experience[];
  error: boolean;
}

export function useFeedbackFeed() {
  const [state, setState] = useState<FeedState | null>(null);

  const fetchFeed = useCallback(() => {
    Promise.all([
      fetch(`${APP_CONFIG.apiBaseUrl}/feedback`),
      fetch(`${APP_CONFIG.apiBaseUrl}/experiences`),
    ])
      .then(async ([feedResponse, expResponse]) => {
        if (!feedResponse.ok || !expResponse.ok) throw new Error('API failed');
        const [feedData, expData] = await Promise.all([feedResponse.json(), expResponse.json()]);
        setState({ feed: feedData, experiences: expData, error: false });
      })
      .catch((err: unknown) => {
        logger.error('Failed to fetch feedback feed:', err);
        setState({ feed: [], experiences: [], error: true });
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${APP_CONFIG.apiBaseUrl}/feedback`),
      fetch(`${APP_CONFIG.apiBaseUrl}/experiences`),
    ])
      .then(async ([feedResponse, expResponse]) => {
        if (cancelled) return;
        if (!feedResponse.ok || !expResponse.ok) throw new Error('API failed');
        const [feedData, expData] = await Promise.all([feedResponse.json(), expResponse.json()]);
        if (!cancelled) setState({ feed: feedData, experiences: expData, error: false });
      })
      .catch((fetchErr) => {
        if (cancelled) return;
        logger.error('Failed to fetch feedback feed:', fetchErr);
        if (!cancelled) setState({ feed: [], experiences: [], error: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    feed: state?.feed ?? [],
    experiences: state?.experiences ?? [],
    loading: state === null,
    error: state?.error ?? false,
    refetch: fetchFeed,
  };
}

export type { FeedbackServerEntry, FeedState };
