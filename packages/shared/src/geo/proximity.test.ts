import { describe, it, expect } from 'vitest';
import { resolveListenRadius, resolveProximity, type GeoFenceConfig } from './proximity';

const geofence: GeoFenceConfig = {
  trip: { radiusMeters: 50, defaultMode: 'formatDefaultRadius' },
  track: { radiusMeters: 110, defaultMode: 'entityRadius' },
  bypassGeofence: false,
};

describe('resolveListenRadius precedence', () => {
  it('bypass wins over any mode, including a presumably-invalid entity radius', () => {
    expect(
      resolveListenRadius({
        format: 'trip',
        geoMode: 'entityRadius',
        radiusMeters: null,
        bypassGeofence: true,
        geofence,
      }),
    ).toEqual({ status: 'unrestricted', reason: 'bypass' });
  });

  it('entityRadius mode gates by its own radiusMeters', () => {
    expect(
      resolveListenRadius({
        format: 'track',
        geoMode: 'entityRadius',
        radiusMeters: 30,
        bypassGeofence: false,
        geofence,
      }),
    ).toEqual({ status: 'gated', radiusMeters: 30, mode: 'entityRadius' });
  });

  it('entityRadius mode fails closed on missing (null) radius', () => {
    expect(
      resolveListenRadius({
        format: 'track',
        geoMode: 'entityRadius',
        radiusMeters: null,
        bypassGeofence: false,
        geofence,
      }),
    ).toEqual({ status: 'blocked', reason: 'invalid-radius' });
  });

  it('entityRadius mode fails closed on non-positive radius', () => {
    for (const radius of [0, -5]) {
      expect(
        resolveListenRadius({
          format: 'track',
          geoMode: 'entityRadius',
          radiusMeters: radius,
          bypassGeofence: false,
          geofence,
        }),
      ).toEqual({ status: 'blocked', reason: 'invalid-radius' });
    }
  });

  it('formatDefaultRadius mode uses geofence.trip.radiusMeters', () => {
    expect(
      resolveListenRadius({
        format: 'trip',
        geoMode: 'formatDefaultRadius',
        bypassGeofence: false,
        geofence,
      }),
    ).toEqual({ status: 'gated', radiusMeters: 50, mode: 'formatDefaultRadius' });
  });

  it('formatDefaultRadius mode uses geofence.track.radiusMeters', () => {
    expect(
      resolveListenRadius({
        format: 'track',
        geoMode: 'formatDefaultRadius',
        bypassGeofence: false,
        geofence,
      }),
    ).toEqual({ status: 'gated', radiusMeters: 110, mode: 'formatDefaultRadius' });
  });

  it('unrestricted mode is un-gated', () => {
    expect(
      resolveListenRadius({
        format: 'track',
        geoMode: 'unrestricted',
        bypassGeofence: false,
        geofence,
      }),
    ).toEqual({ status: 'unrestricted', reason: 'unrestricted' });
  });

  it('missing geoMode falls back to geofence[format].defaultMode (trip -> type)', () => {
    expect(resolveListenRadius({ format: 'trip', bypassGeofence: false, geofence })).toEqual({
      status: 'gated',
      radiusMeters: 50,
      mode: 'formatDefaultRadius',
    });
  });

  it('missing geoMode falls back to geofence[format].defaultMode (track -> entity, fail-closed without radius)', () => {
    expect(resolveListenRadius({ format: 'track', bypassGeofence: false, geofence })).toEqual({
      status: 'blocked',
      reason: 'invalid-radius',
    });
  });
});

describe('resolveProximity', () => {
  const origin = { latitude: -31.979027, longitude: -64.635817 };

  it('user at origin (within radius) -> allowed, inclusive boundary holds', () => {
    const result = resolveProximity({
      format: 'trip',
      geoMode: 'entityRadius',
      radiusMeters: 50,
      bypassGeofence: false,
      geofence,
      user: origin,
      origin,
    });
    expect(result.canListen).toBe(true);
    expect(result.distanceMeters).toBe(0);
    expect(result.effectiveRadiusMeters).toBe(50);
    expect(result.resolution).toBe('allowed');
  });

  it('far user -> blocked with computed distanceMeters and inclusive boundary', () => {
    const user = { latitude: -31.979027 + 0.003, longitude: -64.635817 };
    const result = resolveProximity({
      format: 'trip',
      geoMode: 'entityRadius',
      radiusMeters: 50,
      bypassGeofence: false,
      geofence,
      user,
      origin,
    });
    expect(result.canListen).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(50);
    expect(result.effectiveRadiusMeters).toBe(50);
    expect(result.resolution).toBe('blocked');
  });

  it('user === null -> no-fix, blocked until a fix', () => {
    const result = resolveProximity({
      format: 'trip',
      geoMode: 'entityRadius',
      radiusMeters: 50,
      bypassGeofence: false,
      geofence,
      user: null,
      origin,
    });
    expect(result.canListen).toBe(false);
    expect(result.distanceMeters).toBeNull();
    expect(result.effectiveRadiusMeters).toBe(50);
    expect(result.resolution).toBe('no-fix');
  });

  it('unrestricted -> canListen true with null distance/effective radius', () => {
    const result = resolveProximity({
      format: 'track',
      geoMode: 'unrestricted',
      bypassGeofence: false,
      geofence,
      user: { latitude: 99, longitude: 99 },
      origin,
    });
    expect(result.canListen).toBe(true);
    expect(result.distanceMeters).toBeNull();
    expect(result.effectiveRadiusMeters).toBeNull();
    expect(result.resolution).toBe('unrestricted');
  });

  it('bypass -> canListen true, resolution bypass (wins over invalid entity radius)', () => {
    const result = resolveProximity({
      format: 'track',
      geoMode: 'entityRadius',
      radiusMeters: null,
      bypassGeofence: true,
      geofence,
      user: null,
      origin,
    });
    expect(result.canListen).toBe(true);
    expect(result.effectiveRadiusMeters).toBeNull();
    expect(result.resolution).toBe('bypass');
  });

  it('entityRadius with unresolved radius -> blocked (fail-closed)', () => {
    const result = resolveProximity({
      format: 'track',
      geoMode: 'entityRadius',
      radiusMeters: null,
      bypassGeofence: false,
      geofence,
      user: { latitude: 0, longitude: 0 },
      origin,
    });
    expect(result.canListen).toBe(false);
    expect(result.resolution).toBe('blocked');
  });
});
