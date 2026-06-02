import { useState, useEffect, useCallback, useRef } from 'react';
import * as Storage from '@/storage/feedback-storage';
import type { FeedbackEntry } from '@/types/feedback';

const QUEUE_KEY = Storage.QUEUE_KEY;

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface EnqueueInput {
  tripId: string;
  message: string;
}

/**
 * Manages an offline feedback queue backed by expo-sqlite/kv-store.
 * Provides enqueue, getAll, remove, and clear operations.
 * Queue entries are stored as a JSON array under a single key.
 */
export function useFeedbackQueue() {
  const [queue, setQueue] = useState<FeedbackEntry[]>([]);
  const [_loaded, setLoaded] = useState(false);
  const initializedRef = useRef(false);

  // Load queue from storage on mount (once)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    Storage.getItem(QUEUE_KEY)
      .then((raw) => {
        const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
        setQueue(entries);
      })
      .catch(() => {
        setQueue([]);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  const saveToStorage = useCallback(async (entries: FeedbackEntry[]): Promise<void> => {
    await Storage.setItem(QUEUE_KEY, JSON.stringify(entries));
    setQueue(entries);
  }, []);

  const enqueue = useCallback(
    async (input: EnqueueInput, existingKey?: string): Promise<string> => {
      // Always read fresh from storage to avoid race conditions
      const raw = await Storage.getItem(QUEUE_KEY);
      const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
      const id = existingKey ?? generateId();

      // Dedup by id: if the same key already exists, return it
      const existing = entries.find((e) => e.id === id);
      if (existing) return existing.id;

      const entry: FeedbackEntry = {
        id,
        tripId: input.tripId,
        message: input.message,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
      };

      entries.push(entry);
      await saveToStorage(entries);
      return entry.id;
    },
    [saveToStorage],
  );

  /** Returns entries from the in-memory cache (instant, no async). */
  const getAll = useCallback((): FeedbackEntry[] => {
    return queue;
  }, [queue]);

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const raw = await Storage.getItem(QUEUE_KEY);
      const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
      const filtered = entries.filter((e) => e.id !== id);
      await saveToStorage(filtered);
    },
    [saveToStorage],
  );

  const clear = useCallback(async (): Promise<void> => {
    await Storage.removeItem(QUEUE_KEY);
    setQueue([]);
  }, []);

  return { enqueue, getAll, remove, clear, loaded: _loaded };
}
