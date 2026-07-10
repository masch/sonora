import { appStorage } from './app-storage';
import type { RemoteConfigPayload } from '@sonora/shared';

const CONFIG_CACHE_KEY = 'remote-config';

export async function getCachedConfig(): Promise<RemoteConfigPayload | null> {
  try {
    const raw = await appStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RemoteConfigPayload;
  } catch {
    return null;
  }
}

export async function setCachedConfig(config: RemoteConfigPayload): Promise<void> {
  await appStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
}

export async function clearCachedConfig(): Promise<void> {
  await appStorage.removeItem(CONFIG_CACHE_KEY);
}
