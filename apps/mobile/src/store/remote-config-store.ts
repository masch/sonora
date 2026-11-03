import { create } from 'zustand';
import Constants from 'expo-constants';
import type { RemoteConfigPayload } from '@sonora/shared';
import { DEFAULT_REMOTE_CONFIG, RemoteConfigPayloadSchema, gte } from '@sonora/shared';
import { getCachedConfig, setCachedConfig } from '../storage/config-cache';
import type { CachedConfigRead, CachedRemoteConfig } from '../storage/config-cache';
import { APP_CONFIG } from '../config/app-config';
import { ApiClient } from '../services/api-client';
import { logger } from '../utils/logger';

/**
 * Budget for one `/config` attempt.
 *
 * Three seconds was shorter than a cold radio costs on Android — DNS, then TCP,
 * then TLS, with the radio itself waking up first — so the run that matters most
 * (the cold start after the app had been closed) was the one most likely to be
 * cut off before its answer arrived. Config renders from cache first, so a longer
 * budget delays nothing the walker can see.
 */
const CONFIG_TIMEOUT_MS = 8000;

/**
 * Attempts per revalidation. One attempt plus two retries retires the failure the
 * field report describes (a single run aborted, previous payload kept for good)
 * without turning a genuinely offline phone into a busy loop.
 */
const CONFIG_MAX_ATTEMPTS = 3;

/** 500 ms, then 1 s: enough that a retry never rides a radio that is still waking. */
const CONFIG_RETRY_BASE_MS = 500;

/**
 * How old a cached payload may be before it stops being an answer in its own
 * right. Half an hour is short enough that a map version published in the
 * morning reaches a phone opened after lunch, and long enough that an ordinary
 * app switch reuses the cache instead of insisting on the network.
 */
const CONFIG_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const INITIAL_REMOTE_CONFIG: RemoteConfigPayload = {
  ...DEFAULT_REMOTE_CONFIG,
  geofence: {
    ...DEFAULT_REMOTE_CONFIG.geofence,
    bypassGeofence: APP_CONFIG.geofence.bypassGeofence,
    bypassIosBrowser: APP_CONFIG.geofence.bypassIosBrowser,
  },
  // The build floor of the renderer chain (T10): before the server answers, and
  // for any payload that predates the field, the build's own choice is what
  // counts. The catalog itself has no compiled floor: the archive url is per
  // region and only the server knows which regions it published.
  map: { ...DEFAULT_REMOTE_CONFIG.map, renderer: APP_CONFIG.mapRenderer },
};

export type VersionStatus = 'ok' | 'warn' | 'block';

/**
 * Pure function: compare installed app version against minimum version.
 * Returns the appropriate version status based on the config.
 *
 * Grace period is a server-authoritative ISO date range (`gracePeriodStart` to `gracePeriodEnd`).
 * If either date is absent, block is immediate — no client-side grace tracking.
 *
 * @param installedVersion — from Constants.expoConfig.version (empty if unavailable)
 * @param minimumVersion — minimum required version from remote config
 * @param blockOlderVersions — whether to block or warn when below minimum
 * @param gracePeriodStart — ISO date when grace period starts (undefined = immediate block)
 * @param gracePeriodEnd — ISO date when grace period ends (undefined = immediate block)
 */
export function computeVersionStatus(
  installedVersion: string,
  minimumVersion: string,
  blockOlderVersions: boolean,
  gracePeriodStart: string | undefined,
  gracePeriodEnd: string | undefined,
): VersionStatus {
  // No installed version (offline first-launch) -> ok
  if (!installedVersion) return 'ok';

  const comparison = gte(installedVersion, minimumVersion);

  // Invalid semver -> block (fail closed per spec)
  if (comparison === null) return 'block';

  // Version meets minimum -> ok
  if (comparison) return 'ok';

  // Version is below minimum
  if (blockOlderVersions) {
    // Check grace period: server-authoritative date range
    if (gracePeriodStart && gracePeriodEnd) {
      const startMs = new Date(gracePeriodStart).getTime();
      const endMs = new Date(gracePeriodEnd).getTime();
      if (isNaN(startMs) || isNaN(endMs)) return 'block'; // invalid date -> no grace
      const now = Date.now();
      if (now >= startMs && now < endMs) {
        return 'warn';
      }
    }
    return 'block';
  }

  return 'warn';
}

/**
 * Per-field merge: validate each API response key against its Zod schema.
 * Valid keys override defaults; invalid or missing keys keep their default.
 */
function mergeRemoteConfig(
  defaults: RemoteConfigPayload,
  remote: Partial<RemoteConfigPayload>,
): RemoteConfigPayload {
  const result = { ...defaults };
  const shape = RemoteConfigPayloadSchema.shape;

  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const value = remote[key as keyof RemoteConfigPayload];
    if (value === undefined) continue;

    // Zod validates each field independently — invalid remote values are discarded
    const fieldSchema = shape[key];
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success) {
      (result as Record<string, unknown>)[key] = parsed.data;
    }
  }

  return result;
}

interface RemoteConfigState {
  config: RemoteConfigPayload;
  isLoading: boolean;
  error: Error | null;
  versionStatus: VersionStatus;
  /** Initialise config: read cache, fetch API, merge. Call once at app startup. */
  init: () => Promise<void>;
  /**
   * Re-fetch config from the API, cache first for instant render.
   *
   * Safe to call at any time: a call that lands while a run is still in flight is
   * dropped rather than racing it to the cache, and a run that fails is retried
   * before the store settles on what it already had.
   */
  refetch: () => void;
}

/**
 * A cache read arrives either as this build's stamped entry or, from a cache
 * written before the stamp existed (and from the browser bundle's cache module,
 * which still writes the bare payload), as the payload alone. Both render; the
 * payload alone cannot say how old it is, and an unknown age is not a trusted age.
 */
function toCachedEntry(read: CachedConfigRead): CachedRemoteConfig {
  return 'config' in read ? read : { config: read, fetchedAt: null };
}

function isCachedConfigStale(entry: CachedRemoteConfig): boolean {
  return entry.fetchedAt === null || Date.now() - entry.fetchedAt > CONFIG_CACHE_MAX_AGE_MS;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useRemoteConfigStore = create<RemoteConfigState>((set, get) => {
  /** One `/config` attempt with its own budget, so a retry starts from a live signal. */
  async function requestConfig(): Promise<Partial<RemoteConfigPayload>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
    try {
      return await ApiClient.get<Partial<RemoteConfigPayload>>('/config', {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadConfig() {
    set({ isLoading: true, error: null });

    // Read cache immediately for instant render
    let cached: CachedRemoteConfig | null = null;
    try {
      const read = await getCachedConfig();
      cached = read ? toCachedEntry(read) : null;
      if (cached) {
        // Deep-merge cache into defaults so nested partial values
        // (e.g. geofence with only radiusMeters) don't lose default fields.
        const merged: Record<string, unknown> = { ...INITIAL_REMOTE_CONFIG };
        for (const key of Object.keys(cached.config) as (keyof RemoteConfigPayload)[]) {
          const val = cached.config[key];
          if (val !== undefined && typeof val === 'object' && val !== null && !Array.isArray(val)) {
            (merged as Record<string, unknown>)[key] = {
              ...((merged as Record<string, unknown>)[key] as Record<string, unknown>),
              ...val,
            };
          } else if (val !== undefined) {
            (merged as Record<string, unknown>)[key] = val;
          }
        }
        set({ config: merged as RemoteConfigPayload });
      }
    } catch (err) {
      // Cache read failed — ignore, defaults will be used
      logger.warn(
        '[RemoteConfigStore] Failed to read config cache',
        (err as Error)?.message ?? err,
      );
    }

    // A fresh cache is already an answer, so one failed attempt may settle on it.
    // A stale one is only what we happen to be showing, so the whole retry budget
    // is spent before the store accepts it — that is what keeps a cached payload
    // from winning forever. With no cache at all there is nothing to settle on.
    const attempts = cached && !isCachedConfigStale(cached) ? 1 : CONFIG_MAX_ATTEMPTS;

    let lastError: unknown = null;
    let settled = false;

    for (let attempt = 0; attempt < attempts && !settled; attempt += 1) {
      if (attempt > 0) await delay(CONFIG_RETRY_BASE_MS * 2 ** (attempt - 1));
      try {
        const raw = await requestConfig();
        // API wins over both cache and defaults.
        const merged = mergeRemoteConfig(
          INITIAL_REMOTE_CONFIG,
          cached ? { ...cached.config, ...raw } : raw,
        );
        set({ config: merged, error: null });
        lastError = null;
        try {
          await setCachedConfig(merged);
        } catch (err) {
          // A cache we could not write costs the next cold start its head start;
          // it does not invalidate the payload we just got.
          logger.warn(
            '[RemoteConfigStore] Failed to write config cache',
            (err as Error)?.message ?? err,
          );
        }
        settled = true;
      } catch (err) {
        lastError = err;
      }
    }

    // ── Compute versionStatus (server-authoritative grace period) ───
    const installedVersion = Constants.expoConfig?.version ?? '';
    const { appVersion } = get().config;

    const versionStatus = computeVersionStatus(
      installedVersion,
      appVersion.minimumVersion,
      appVersion.blockOlderVersions,
      appVersion.gracePeriodStart,
      appVersion.gracePeriodEnd,
    );

    set({ versionStatus });

    // An abort is not an actionable error: with a cache the walker keeps a
    // working app, and without one the defaults still carry the build's floor.
    const aborted = lastError instanceof Error && lastError.name === 'AbortError';
    if (lastError && !aborted && !cached) {
      set({ error: lastError instanceof Error ? lastError : new Error('Failed to load config') });
    }

    set({ isLoading: false });
  }

  let inFlight = false;

  async function runConfigRefresh(): Promise<void> {
    // A foreground resume can land while the cold-start run is still waiting on a
    // sleeping radio; two runs would race to write the cache with different ages.
    if (inFlight) return;
    inFlight = true;
    try {
      await loadConfig();
    } finally {
      inFlight = false;
    }
  }

  return {
    config: INITIAL_REMOTE_CONFIG,
    isLoading: true,
    error: null,
    versionStatus: 'ok',

    init: runConfigRefresh,

    refetch: () => {
      void runConfigRefresh();
    },
  };
});
