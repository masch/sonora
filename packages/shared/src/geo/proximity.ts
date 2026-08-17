import type { UserExperienceFormat } from '../experiences';

export const GEO_MODES = ['unrestricted', 'formatDefaultRadius', 'entityRadius'] as const;
export type GeoMode = (typeof GEO_MODES)[number];

/** Per-format geofence block (same shape for trip & track). */
export interface GeoFormatGeoFence {
  radiusMeters: number; // type-level fallback, positive
  defaultMode: GeoMode; // format-level default listening mode
}

export interface GeoFenceConfig {
  trip: GeoFormatGeoFence;
  track: GeoFormatGeoFence;
  bypassGeofence: boolean; // global master switch, wins over all modes
}

/** Coordinates input (pure, not RN-expo-location). */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface ListenRadiusInput {
  format: UserExperienceFormat; // 'trip' | 'track'
  geoMode?: GeoMode; // optional; falls back to geofence[format].defaultMode
  radiusMeters?: number | null; // entity radius, meaningful only when entity mode
  bypassGeofence: boolean;
  geofence: GeoFenceConfig;
}

export type RadiusResolution =
  | { status: 'unrestricted'; reason: 'bypass' | 'unrestricted' }
  | { status: 'gated'; radiusMeters: number; mode: 'entityRadius' | 'formatDefaultRadius' }
  | { status: 'blocked'; reason: 'invalid-radius' };

/**
 * Pure precedence resolver — the single source of truth for effective radius.
 * Two-tier: bypass > unrestricted > entityRadius > formatDefaultRadius > defensive unrestricted fallback.
 */
export function resolveListenRadius(input: ListenRadiusInput): RadiusResolution {
  const mode = input.geoMode ?? input.geofence[input.format].defaultMode;

  // 1. bypass (global switch) wins over all modes, even an invalid entity radius.
  if (input.bypassGeofence) {
    return { status: 'unrestricted', reason: 'bypass' };
  }

  // 2. unrestricted -> always playable (no gating).
  if (mode === 'unrestricted') {
    return { status: 'unrestricted', reason: 'unrestricted' };
  }

  // 3. entityRadius -> entity's own radius; fail-closed if unresolved/invalid.
  if (mode === 'entityRadius') {
    if (!(typeof input.radiusMeters === 'number' && input.radiusMeters > 0)) {
      return { status: 'blocked', reason: 'invalid-radius' };
    }
    return { status: 'gated', radiusMeters: input.radiusMeters, mode: 'entityRadius' };
  }

  // 4. formatDefaultRadius -> per-format default fallback radius.
  if (mode === 'formatDefaultRadius') {
    return {
      status: 'gated',
      radiusMeters: input.geofence[input.format].radiusMeters,
      mode: 'formatDefaultRadius',
    };
  }

  // 5. Defensive fallback (unknown mode) -> un-gated.
  return { status: 'unrestricted', reason: 'unrestricted' };
}

export interface ProximityDecisionInput extends ListenRadiusInput {
  user: { latitude: number; longitude: number } | null;
  origin: { latitude: number; longitude: number };
}

export interface ProximityDecision {
  canListen: boolean;
  distanceMeters: number | null;
  effectiveRadiusMeters: number | null;
  resolution: 'allowed' | 'blocked' | 'bypass' | 'unrestricted' | 'no-fix';
}

/** Top-level: resolve radius + distance + inclusive boundary in one call. */
export function resolveProximity(input: ProximityDecisionInput): ProximityDecision {
  const r = resolveListenRadius(input);

  if (r.status === 'unrestricted') {
    return {
      canListen: true,
      distanceMeters: null,
      effectiveRadiusMeters: null,
      resolution: r.reason === 'bypass' ? 'bypass' : 'unrestricted',
    };
  }

  if (r.status === 'blocked') {
    return {
      canListen: false,
      distanceMeters: null,
      effectiveRadiusMeters: null,
      resolution: 'blocked',
    };
  }

  if (input.user == null) {
    return {
      canListen: false,
      distanceMeters: null,
      effectiveRadiusMeters: r.radiusMeters,
      resolution: 'no-fix',
    };
  }

  const distance = haversineDistance(
    input.user.latitude,
    input.user.longitude,
    input.origin.latitude,
    input.origin.longitude,
  );

  // Inclusive boundary: distance <= radius (GEOF.7).
  return {
    canListen: distance <= r.radiusMeters,
    distanceMeters: distance,
    effectiveRadiusMeters: r.radiusMeters,
    resolution: distance <= r.radiusMeters ? 'allowed' : 'blocked',
  };
}

/**
 * Geodetic distance between two coordinates in meters (Haversine formula).
 * Single source of truth for proximity math, reused by api + mobile.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
