/**
 * Storage backend for the feedback queue.
 *
 * - **Native** (iOS/Android): uses `expo-sqlite/kv-store` (SQLite-backed).
 * - **Web**: Metro resolves `feedback-storage.web.ts` instead — uses localStorage
 *   to avoid wa-sqlite wasm bundling issues and COOP/COEP headers.
 *
 * This base file is the TypeScript-checked declaration and the impl used by
 * Jest and native builds. Web gets its own `.web.ts` override at bundle time.
 */
import SqliteStorage from 'expo-sqlite/kv-store';

const QUEUE_KEY = 'feedback_queue';

export async function getItem(key: string): Promise<string | null> {
  return SqliteStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  return SqliteStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  return SqliteStorage.removeItem(key);
}

export { QUEUE_KEY };
