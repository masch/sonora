import { describe, expect, it } from 'vitest';
import { normalizeDeviceIdList, resolveMapRenderer } from '../map-renderer';

describe('normalizeDeviceIdList', () => {
  it('splits on commas, trims each entry and drops the empty ones', () => {
    expect(normalizeDeviceIdList(' a1b2 , c3d4 ,, e5f6 ,')).toEqual(['a1b2', 'c3d4', 'e5f6']);
  });

  it('returns an empty list for an unset or blank variable', () => {
    expect(normalizeDeviceIdList(undefined)).toEqual([]);
    expect(normalizeDeviceIdList('')).toEqual([]);
    expect(normalizeDeviceIdList(' , ,, ')).toEqual([]);
  });

  it('dedupes repeated ids and keeps the first occurrence order', () => {
    expect(normalizeDeviceIdList('b, a, b, a , c')).toEqual(['b', 'a', 'c']);
  });

  it('does not throw on a garbage blob and never yields a blank entry', () => {
    const result = normalizeDeviceIdList('{"ids":["a","b"]}\u0000\n\t,,;--');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry.length).toBeGreaterThan(0);
      expect(entry).toBe(entry.trim());
    }
  });

  it('handles a ten-thousand entry list without throwing', () => {
    const raw = Array.from({ length: 10_000 }, (_, index) => `device-${index}`).join(',');
    const result = normalizeDeviceIdList(raw);
    expect(result).toHaveLength(10_000);
    expect(result[0]).toBe('device-0');
    expect(result[result.length - 1]).toBe('device-9999');
  });
});

describe('resolveMapRenderer', () => {
  it('keeps an unlisted device on the leaflet fallback', () => {
    expect(
      resolveMapRenderer({ deviceId: 'hash-1', allowed: [], blocked: [], fallback: 'leaflet' }),
    ).toBe('leaflet');
  });

  it('promotes an allowed device to maplibre over a leaflet fallback', () => {
    expect(
      resolveMapRenderer({
        deviceId: 'hash-1',
        allowed: ['hash-1'],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('maplibre');
  });

  it('keeps an unlisted device on the maplibre fallback', () => {
    expect(
      resolveMapRenderer({ deviceId: 'hash-1', allowed: [], blocked: [], fallback: 'maplibre' }),
    ).toBe('maplibre');
  });

  it('demotes a blocked device to leaflet over a maplibre fallback', () => {
    expect(
      resolveMapRenderer({
        deviceId: 'hash-1',
        allowed: [],
        blocked: ['hash-1'],
        fallback: 'maplibre',
      }),
    ).toBe('leaflet');
  });

  it('lets the block win when a device is in both lists', () => {
    expect(
      resolveMapRenderer({
        deviceId: 'hash-1',
        allowed: ['hash-1'],
        blocked: ['hash-1'],
        fallback: 'maplibre',
      }),
    ).toBe('leaflet');
  });

  it('gives the fallback to a missing, empty, blank or over-long device id', () => {
    for (const deviceId of [undefined, '', '   ', 'x'.repeat(257)]) {
      expect(
        resolveMapRenderer({
          deviceId,
          allowed: ['x'.repeat(257), '', '   '],
          blocked: [],
          fallback: 'leaflet',
        }),
      ).toBe('leaflet');
      expect(
        resolveMapRenderer({
          deviceId,
          allowed: [],
          blocked: ['x'.repeat(257), '', '   '],
          fallback: 'maplibre',
        }),
      ).toBe('maplibre');
    }
  });

  it('accepts a 256-character device id at the boundary', () => {
    const boundary = 'x'.repeat(256);
    expect(
      resolveMapRenderer({
        deviceId: boundary,
        allowed: [boundary],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('maplibre');
  });

  it('compares ids exactly, without case folding', () => {
    expect(
      resolveMapRenderer({
        deviceId: 'abc',
        allowed: ['ABC', 'Abc'],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('leaflet');
    expect(
      resolveMapRenderer({
        deviceId: 'ABC',
        allowed: ['ABC'],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('maplibre');
  });

  it('ignores unusable entries in a garbage list', () => {
    expect(
      resolveMapRenderer({
        deviceId: 'hash-1',
        allowed: ['', '   ', ',', 'not a hash'],
        blocked: ['', '  '],
        fallback: 'maplibre',
      }),
    ).toBe('maplibre');
  });

  it('matches the ids the normalizer produced from a raw variable', () => {
    expect(
      resolveMapRenderer({
        deviceId: 'hash-b',
        allowed: normalizeDeviceIdList(' hash-a , hash-b ,, hash-b ,'),
        blocked: normalizeDeviceIdList(undefined),
        fallback: 'leaflet',
      }),
    ).toBe('maplibre');
  });

  it('resolves against a ten-thousand entry allowlist', () => {
    const allowed = Array.from({ length: 10_000 }, (_, index) => `device-${index}`);
    expect(
      resolveMapRenderer({ deviceId: 'device-9999', allowed, blocked: [], fallback: 'leaflet' }),
    ).toBe('maplibre');
  });
});
