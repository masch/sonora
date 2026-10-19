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

/** Everything {@link resolveMapRenderer} needs; both lists are already normalized. */
export interface MapRendererResolution {
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
 * Resolves the renderer for one device: **denylist → allowlist → fallback**.
 *
 * - The denylist is read first, so a blocked device gets `leaflet` even when the fallback is `maplibre`.
 * - The allowlist is read next, so an allowed device gets `maplibre` even when the fallback is `leaflet`.
 * - A device named by both lists gets `leaflet`: the block always wins.
 * - A missing, empty, blank or over-256-character id is unknown and gets the fallback.
 * - A device named by neither list is unknown and gets the fallback.
 * - The header is trimmed of surrounding whitespace first; after that ids compare exactly, with no case folding, because they are opaque client hashes.
 */
export function resolveMapRenderer({
  deviceId,
  allowed,
  blocked,
  fallback,
}: MapRendererResolution): MapRenderer {
  const candidate = deviceId?.trim();
  if (!candidate || candidate.length > MAX_DEVICE_ID_LENGTH) return fallback;
  if (blocked.includes(candidate)) return 'leaflet';
  if (allowed.includes(candidate)) return 'maplibre';
  return fallback;
}
