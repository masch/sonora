import { create } from 'zustand';
import Constants from 'expo-constants';
import type { RemoteConfigPayload } from '@sonora/shared';
import { DEFAULT_REMOTE_CONFIG, RemoteConfigPayloadSchema, gte } from '@sonora/shared';
import { getCachedConfig, setCachedConfig } from '../storage/config-cache';
import { ApiClient } from '../services/api-client';
import { logger } from '../utils/logger';

const CONFIG_TIMEOUT_MS = 3000;

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
  /** Re-fetch config from the API. Call to refresh at any time. */
  refetch: () => void;
}

export const useRemoteConfigStore = create<RemoteConfigState>((set, get) => {
  async function loadConfig(signal: AbortSignal) {
    set({ isLoading: true, error: null });

    // Read cache immediately for instant render
    let cached: RemoteConfigPayload | null = null;
    try {
      cached = await getCachedConfig();
      if (cached) {
        // Deep-merge cache into defaults so nested partial values
        // (e.g. geofence with only radiusMeters) don't lose default fields.
        const merged: Record<string, unknown> = { ...DEFAULT_REMOTE_CONFIG };
        for (const key of Object.keys(cached) as (keyof RemoteConfigPayload)[]) {
          const val = cached[key];
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

    // Try API — overlay cache first, then API wins over both cache and defaults.
    let apiError: unknown = null;
    try {
      const raw = await ApiClient.get<Partial<RemoteConfigPayload>>('/config', { signal });
      const merged = mergeRemoteConfig(DEFAULT_REMOTE_CONFIG, cached ? { ...cached, ...raw } : raw);
      await setCachedConfig(merged);
      set({ config: merged, error: null });
    } catch (err) {
      apiError = err;
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

    if (apiError) {
      if (apiError instanceof Error && apiError.name === 'AbortError') {
        // Timeout — not an actionable error, keep current config
        set({ isLoading: false });
        return;
      }
      if (!cached) {
        set({ error: apiError instanceof Error ? apiError : new Error('Failed to load config') });
      }
    }

    set({ isLoading: false });
  }

  return {
    config: DEFAULT_REMOTE_CONFIG,
    isLoading: true,
    error: null,
    versionStatus: 'ok',

    init: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
      try {
        await loadConfig(controller.signal);
      } finally {
        clearTimeout(timer);
      }
    },

    refetch: () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
      loadConfig(controller.signal).finally(() => clearTimeout(timer));
    },
  };
});
