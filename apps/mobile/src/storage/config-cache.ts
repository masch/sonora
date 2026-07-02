import SqliteStorage from 'expo-sqlite/kv-store';
import type { RemoteConfigPayload } from '@sonora/shared';

const CONFIG_CACHE_KEY = 'remote-config';

export async function getCachedConfig(): Promise<RemoteConfigPayload | null> {
  try {
    const raw = await SqliteStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RemoteConfigPayload;
  } catch {
    return null;
  }
}

export async function setCachedConfig(config: RemoteConfigPayload): Promise<void> {
  await SqliteStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
}

export async function clearCachedConfig(): Promise<void> {
  await SqliteStorage.removeItem(CONFIG_CACHE_KEY);
}
