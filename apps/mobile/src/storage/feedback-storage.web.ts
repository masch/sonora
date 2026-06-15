/**
 * Web storage backend for the feedback queue.
 * Uses localStorage directly — avoids wa-sqlite wasm bundling issues
 * and the need for COOP/COEP headers on static web deployments.
 */
const QUEUE_KEY = 'feedback_queue';

export async function getItem(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  localStorage.removeItem(key);
}

export { QUEUE_KEY };
