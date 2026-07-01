import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';
import { type Experience } from '@/data/experiences';
import { ApiClient } from '@/services/api-client';

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

async function fetchFeedData(): Promise<{
  feed: FeedbackServerEntry[];
  experiences: Experience[];
}> {
  const [feedData, expData] = await Promise.all([
    ApiClient.get<FeedbackServerEntry[]>('/feedback'),
    ApiClient.get<Experience[]>('/experiences'),
  ]);

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
    fetchFeedData()
      .then((data) => setState({ ...data, error: false, loading: false }))
      .catch((err: unknown) => {
        logger.error('Failed to fetch feedback feed:', err);
        setState({ feed: [], experiences: [], error: true, loading: false });
      });
  }, []);

  const refetch = () => {
    setState((prev) => ({ ...prev, loading: true, error: false }));
    fetchFeedData()
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
