import { useState, useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getItem, setItem, removeItem, QUEUE_KEY } from '@/storage/feedback-storage';
import type { FeedbackEntry } from '@/types/feedback';
import { generateUUID } from '@/utils/uuid';

function generateId(): string {
  return generateUUID();
}

interface EnqueueInput {
  experienceId: string;
  message: string;
  latitude?: number | null;
  longitude?: number | null;
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

    getItem(QUEUE_KEY)
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

  // Listen for background sync updates to update local state dynamically
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('feedback-queue-synced', () => {
      getItem(QUEUE_KEY)
        .then((raw) => {
          const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
          setQueue(entries);
        })
        .catch(() => {});
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const saveToStorage = async (entries: FeedbackEntry[]): Promise<void> => {
    await setItem(QUEUE_KEY, JSON.stringify(entries));
    setQueue(entries);
  };

  const enqueue = async (input: EnqueueInput, existingKey?: string): Promise<string> => {
    // Always read fresh from storage to avoid race conditions
    const raw = await getItem(QUEUE_KEY);
    const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
    const id = existingKey ?? generateId();

    // Dedup by id: if the same key already exists, return it
    const existing = entries.find((e) => e.id === id);
    if (existing) return existing.id;

    const entry: FeedbackEntry = {
      id,
      experienceId: input.experienceId,
      message: input.message,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      lastError: null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    };

    entries.push(entry);
    await saveToStorage(entries);
    return entry.id;
  };

  /** Returns entries from the in-memory cache (instant, no async). */
  const getAll = (): FeedbackEntry[] => {
    return queue;
  };

  const remove = async (id: string): Promise<void> => {
    const raw = await getItem(QUEUE_KEY);
    const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = entries.filter((e) => e.id !== id);
    await saveToStorage(filtered);
  };

  const clear = async (): Promise<void> => {
    await removeItem(QUEUE_KEY);
    setQueue([]);
  };

  return { enqueue, getAll, remove, clear, loaded: _loaded, queue };
}
