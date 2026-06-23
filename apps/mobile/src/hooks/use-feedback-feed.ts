import { useState, useEffect } from 'react';
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
  loading: boolean;
}

async function fetchFeedData(
  apiBaseUrl: string,
): Promise<{ feed: FeedbackServerEntry[]; experiences: Experience[] }> {
  const [feedResponse, expResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/feedback`),
    fetch(`${apiBaseUrl}/experiences`),
  ]);

  if (!feedResponse.ok || !expResponse.ok) throw new Error('API failed');

  const [feedData, expData] = await Promise.all([feedResponse.json(), expResponse.json()]);

  return { feed: feedData, experiences: expData };
}

export function useFeedbackFeed() {
  const [state, setState] = useState<FeedState>({
    feed: [],
    experiences: [],
    error: false,
    loading: true,
  });

  useEffect(() => {
    fetchFeedData(APP_CONFIG.apiBaseUrl)
      .then((data) => setState({ ...data, error: false, loading: false }))
      .catch((err: unknown) => {
        logger.error('Failed to fetch feedback feed:', err);
        setState({ feed: [], experiences: [], error: true, loading: false });
      });
  }, []);

  const refetch = () => {
    setState((prev) => ({ ...prev, loading: true, error: false }));
    fetchFeedData(APP_CONFIG.apiBaseUrl)
      .then((data) => setState({ ...data, error: false, loading: false }))
      .catch((err: unknown) => {
        logger.error('Failed to fetch feedback feed:', err);
        setState({ feed: [], experiences: [], error: true, loading: false });
      });
  };

  return {
    feed: state.feed,
    experiences: state.experiences,
    loading: state.loading,
    error: state.error,
    refetch,
  };
}

export type { FeedbackServerEntry, FeedState };
