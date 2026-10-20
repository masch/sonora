import type { MapRenderer } from '@sonora/shared';

/**
 * Longest device id the resolver accepts. The global device-id middleware
 * already rejects anything longer with a 400, so this exists for the resolver
 * being called with a value that reached it another way.
 */
export const MAX_DEVICE_ID_LENGTH = 256;

/**
 * Normalizes a comma-separated device-id variable from the environment.
 *
 * Splits on commas, trims each entry, drops the empty entries and dedupes while
 * keeping the first occurrence order. Never throws: an unset variable is an
 * empty list, and a garbage blob can only produce trimmed, non-empty entries.
 */
export function normalizeDeviceIdList(raw: string | undefined): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const part of raw.split(',')) {
    const entry = part.trim();
    if (entry.length === 0 || seen.has(entry)) continue;
    seen.add(entry);
    entries.push(entry);
  }
  return entries;
}

/**
 * Platforms that can render the new map when no capability list is configured.
 *
 * The web export emits no MapLibre worker, so a browser cannot mount the new
 * renderer until that worker ships (L37); leaving `web` out of this default is
 * what keeps every browser on Leaflet while the variable is unset.
 */
export const DEFAULT_CAPABLE_PLATFORMS: readonly string[] = ['android', 'ios'];

/**
 * Normalizes a comma-separated platform-capability variable from the environment.
 *
 * Splits on commas, trims and lower-cases each entry, drops the empty entries and
 * dedupes while keeping the first occurrence order. Never throws: an unset
 * variable, or one that yields nothing, is the default capability list, and a
 * garbage blob can only produce trimmed, lower-case, non-empty entries.
 */
export function normalizePlatformList(value: string | undefined): readonly string[] {
  if (!value) return DEFAULT_CAPABLE_PLATFORMS;

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const part of value.split(',')) {
    const entry = part.trim().toLowerCase();
    if (entry.length === 0 || seen.has(entry)) continue;
    seen.add(entry);
    entries.push(entry);
  }
  return entries.length === 0 ? DEFAULT_CAPABLE_PLATFORMS : entries;
}

/** Whether a platform can render the new map at all. */
function isCapable(platform: string | undefined, capablePlatforms: readonly string[]): boolean {
  const candidate = platform?.trim().toLowerCase();
  if (!candidate || candidate.length === 0) return false;
  return capablePlatforms.includes(candidate);
}

/** Everything {@link resolveMapRenderer} needs; every list is already normalized. */
export interface MapRendererResolution {
  /** Raw `X-Device-Platform` header, or `undefined` when the request carries none. */
  platform: string | undefined;
  /** Normalized capability list: only these platforms can render `maplibre`. */
  capablePlatforms: readonly string[];
  /** Raw `X-Device-Id` header, or `undefined` when the request carries none. */
  deviceId: string | undefined;
  /** Normalized allowlist: these devices render `maplibre`. */
  allowed: readonly string[];
  /** Normalized denylist: these devices render `leaflet`. */
  blocked: readonly string[];
  /** The environment's renderer, used by every device no list names. */
  fallback: MapRenderer;
}

/**
 * Resolves the renderer for one device: **capability → denylist → allowlist → fallback**.
 *
 * - Capability is read first and wins over every list: an incapable platform gets `leaflet` even when the fallback is `maplibre` and the device is allowlisted, because rendering is not a preference.
 * - A missing, empty or unknown platform is not capable, so it gets `leaflet` too.
 * - The denylist is read next, so a blocked device gets `leaflet` even when the fallback is `maplibre`.
 * - The allowlist is read next, so an allowed device gets `maplibre` even when the fallback is `leaflet`.
 * - A device named by both lists gets `leaflet`: the block always wins.
 * - A missing, empty, blank or over-256-character id is unknown and gets the fallback.
 * - A device named by neither list is unknown and gets the fallback.
 * - The header is trimmed of surrounding whitespace first; after that ids compare exactly, with no case folding, because they are opaque client hashes.
 */
export function resolveMapRenderer({
  platform,
  capablePlatforms,
  deviceId,
  allowed,
  blocked,
  fallback,
}: MapRendererResolution): MapRenderer {
  if (!isCapable(platform, capablePlatforms)) return 'leaflet';
  const candidate = deviceId?.trim();
  if (!candidate || candidate.length > MAX_DEVICE_ID_LENGTH) return fallback;
  if (blocked.includes(candidate)) return 'leaflet';
  if (allowed.includes(candidate)) return 'maplibre';
  return fallback;
}
