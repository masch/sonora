import { appStorage } from './app-storage';
import type { RemoteConfigPayload } from '@sonora/shared';

const CONFIG_CACHE_KEY = 'remote-config';

/** A cached payload and the moment the fetch that produced it happened. */
export interface CachedRemoteConfig {
  config: RemoteConfigPayload;
  /** Epoch ms; `null` when the entry carries no stamp, so its age is unknown. */
  fetchedAt: number | null;
}

/**
 * What a cache read can hand back.
 *
 * This build writes the stamped entry, but the same key also holds the bare
 * payload every earlier build wrote, and the browser bundle's `config-cache.web`
 * still writes it. A reader takes both shapes rather than assuming the stamp is
 * there: the payload always renders, and only the stamped entry can prove how
 * old it is.
 */
export type CachedConfigRead = CachedRemoteConfig | RemoteConfigPayload;

export async function getCachedConfig(): Promise<CachedConfigRead | null> {
  try {
    const raw = await appStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    const stamp = record.fetchedAt;
    const payload = record.config;
    if (typeof stamp === 'number' && payload && typeof payload === 'object') {
      return { config: payload as RemoteConfigPayload, fetchedAt: stamp };
    }

    // Unstamped: a cache written before the stamp existed. It is still a
    // payload, so it still renders instantly; it just cannot vouch for its age.
    return parsed as RemoteConfigPayload;
  } catch {
    return null;
  }
}

export async function setCachedConfig(config: RemoteConfigPayload): Promise<void> {
  // The write is where the age is recorded, so the reader can tell a payload
  // fetched a minute ago from one fetched a week ago without asking the network.
  const entry: CachedRemoteConfig = { config, fetchedAt: Date.now() };
  await appStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(entry));
}

export async function clearCachedConfig(): Promise<void> {
  await appStorage.removeItem(CONFIG_CACHE_KEY);
}
