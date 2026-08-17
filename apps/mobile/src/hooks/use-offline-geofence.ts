import { useLocationStore } from '@/store/location-store';
import { logger } from '@/utils/logger';
import { resolveProximity, type GeoMode, type UserExperienceFormat } from '@sonora/shared';
import { useEffect, useState } from 'react';
import { useRemoteConfig } from './use-remote-config';

export interface GeofenceState {
  isNearStart: boolean;
  gpsAccuracy: number | null;
  gpsStatus: 'initializing' | 'weak' | 'ready';
  distanceMeters: number | null;
  requiredRadiusMeters: number;
  userCoordinates: { latitude: number; longitude: number } | null;
  errorMsg: string | null;
}

export interface GeofenceOverride {
  geoMode: GeoMode;
  radiusMeters?: number | null;
  format: UserExperienceFormat;
}

/** Result of a best-effort online proximity check (POST /experiences/:id/proximity). */
export interface ProximityClientResult {
  ok: boolean;
  canListen?: boolean;
  distanceMeters?: number | null;
  effectiveRadiusMeters?: number | null;
}

/**
 * Optional online seam. When injected, the hook attempts a best-effort
 * authoritative check; on success it wins, on ANY failure it fails open to
 * the offline/local result. Without an injected client the hook is offline-only.
 */
export interface ProximityClient {
  check(input: {
    experienceId?: string;
    latitude: number;
    longitude: number;
  }): Promise<ProximityClientResult>;
}

// Preserves today's default: trips gate at `geofence.trip.radiusMeters` (50 m).
const DEFAULT_OVERRIDE: GeofenceOverride = { format: 'trip', geoMode: 'formatDefaultRadius' };

export function useOfflineGeofence(
  targetCoords: {
    latitude: number;
    longitude: number;
  } | null,
  override: GeofenceOverride = DEFAULT_OVERRIDE,
  options: { proximityClient?: ProximityClient; experienceId?: string } = {},
): GeofenceState {
  const { config } = useRemoteConfig();
  const { coords, accuracy, status, errorMsg } = useLocationStore();
  const [onlineDecision, setOnlineDecision] = useState<ProximityClientResult | null>(null);

  // Offline/local decision — single source of truth is the shared resolver,
  // reading the locally cached per-format geofence config.
  let resolution: {
    canListen: boolean;
    distanceMeters: number | null;
    effectiveRadiusMeters: number | null;
  };

  if (!targetCoords) {
    resolution = {
      canListen: false,
      distanceMeters: null,
      effectiveRadiusMeters: config.geofence[override.format].radiusMeters,
    };
  } else {
    resolution = resolveProximity({
      user: coords,
      origin: targetCoords,
      format: override.format,
      geoMode: override.geoMode,
      radiusMeters: override.radiusMeters ?? null,
      bypassGeofence: config.geofence.bypassGeofence,
      geofence: config.geofence,
    });
  }

  let isNearStart = resolution.canListen;
  let distanceMeters: number | null = resolution.distanceMeters;
  let requiredRadiusMeters = resolution.effectiveRadiusMeters ?? 0;

  // Best-effort online seam — authoritative if it succeeds, otherwise the
  // offline/local decision above stands (fail open).
  const { proximityClient, experienceId } = options;

  useEffect(() => {
    if (!proximityClient || !targetCoords || !coords) {
      return;
    }
    let cancelled = false;

    proximityClient
      .check({
        experienceId,
        latitude: coords.latitude,
        longitude: coords.longitude,
      })
      .then((resultValue) => {
        if (!cancelled && resultValue.ok) {
          setOnlineDecision(resultValue);
        }
      })
      .catch((err: unknown) => {
        // fail open: keep the offline/local result, but surface the online failure
        logger.error(
          'useOfflineGeofence: online proximity check failed, falling back to offline result',
          err,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [proximityClient, experienceId, targetCoords, coords]);

  if (onlineDecision && onlineDecision.ok) {
    isNearStart = onlineDecision.canListen ?? false;
    distanceMeters = onlineDecision.distanceMeters ?? null;
    requiredRadiusMeters = onlineDecision.effectiveRadiusMeters ?? 0;
  }

  return {
    isNearStart,
    gpsAccuracy: accuracy,
    gpsStatus: status,
    distanceMeters,
    requiredRadiusMeters,
    userCoordinates: coords,
    errorMsg: errorMsg,
  };
}
