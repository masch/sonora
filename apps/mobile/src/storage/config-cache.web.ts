import type { RemoteConfigPayload } from '@sonora/shared';

const CONFIG_CACHE_KEY = 'remote-config';

export async function getCachedConfig(): Promise<RemoteConfigPayload | null> {
  try {
    const raw = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RemoteConfigPayload;
  } catch {
    return null;
  }
}

export async function setCachedConfig(config: RemoteConfigPayload): Promise<void> {
  localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
}

export async function clearCachedConfig(): Promise<void> {
  localStorage.removeItem(CONFIG_CACHE_KEY);
}
