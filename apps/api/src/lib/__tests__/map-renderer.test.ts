import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAPABLE_PLATFORMS,
  normalizeDeviceIdList,
  normalizePlatformList,
  resolveMapRenderer,
} from '../map-renderer';

/**
 * The capability inputs that an unset variable produces. The list-behaviour
 * tests below spread this so each one keeps asserting only what it is named
 * for; the capability gate has its own describe block.
 */
const CAPABLE = {
  platform: 'android',
  capablePlatforms: DEFAULT_CAPABLE_PLATFORMS,
} as const;

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
      resolveMapRenderer({
        ...CAPABLE,
        deviceId: 'hash-1',
        allowed: [],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('leaflet');
  });

  it('promotes an allowed device to maplibre over a leaflet fallback', () => {
    expect(
      resolveMapRenderer({
        ...CAPABLE,
        deviceId: 'hash-1',
        allowed: ['hash-1'],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('maplibre');
  });

  it('keeps an unlisted device on the maplibre fallback', () => {
    expect(
      resolveMapRenderer({
        ...CAPABLE,
        deviceId: 'hash-1',
        allowed: [],
        blocked: [],
        fallback: 'maplibre',
      }),
    ).toBe('maplibre');
  });

  it('demotes a blocked device to leaflet over a maplibre fallback', () => {
    expect(
      resolveMapRenderer({
        ...CAPABLE,
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
        ...CAPABLE,
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
          ...CAPABLE,
          deviceId,
          allowed: ['x'.repeat(257), '', '   '],
          blocked: [],
          fallback: 'leaflet',
        }),
      ).toBe('leaflet');
      expect(
        resolveMapRenderer({
          ...CAPABLE,
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
        ...CAPABLE,
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
        ...CAPABLE,
        deviceId: 'abc',
        allowed: ['ABC', 'Abc'],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('leaflet');
    expect(
      resolveMapRenderer({
        ...CAPABLE,
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
        ...CAPABLE,
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
        ...CAPABLE,
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
      resolveMapRenderer({
        ...CAPABLE,
        deviceId: 'device-9999',
        allowed,
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('maplibre');
  });
});

describe('normalizePlatformList', () => {
  it('yields android and ios — never web — when the variable is unset or yields nothing', () => {
    expect(DEFAULT_CAPABLE_PLATFORMS).toEqual(['android', 'ios']);
    for (const raw of [undefined, '', '   ', ' , ,, ']) {
      expect({ raw, platforms: normalizePlatformList(raw) }).toEqual({
        raw,
        platforms: ['android', 'ios'],
      });
    }
  });

  it('trims, lower-cases and dedupes explicit platform names', () => {
    expect(normalizePlatformList(' Android , IOS ,, android ,  web ')).toEqual([
      'android',
      'ios',
      'web',
    ]);
  });

  it('lets web in only when the data names it', () => {
    expect(normalizePlatformList('android,ios')).toEqual(['android', 'ios']);
    expect(normalizePlatformList('web')).toEqual(['web']);
  });

  it('does not throw on a garbage blob and never yields a blank entry', () => {
    const result = normalizePlatformList('{"platforms":["web"]}\u0000\n\t,,;--');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry.length).toBeGreaterThan(0);
      expect(entry).toBe(entry.trim());
      expect(entry).toBe(entry.toLowerCase());
    }
  });
});

describe('resolveMapRenderer — platform capability', () => {
  const capable = normalizePlatformList('android,ios');

  it('refuses web even when the fallback is maplibre and the device is allowlisted', () => {
    // Capability wins over every list: rendering is not a preference, and the
    // web build cannot mount MapLibre while its worker is not emitted (L37).
    expect(
      resolveMapRenderer({
        platform: 'web',
        capablePlatforms: capable,
        deviceId: 'hash-1',
        allowed: ['hash-1'],
        blocked: [],
        fallback: 'maplibre',
      }),
    ).toBe('leaflet');
  });

  it('lets android and ios follow the lists and the fallback', () => {
    for (const platform of ['android', 'ios']) {
      // Unlisted device on each fallback.
      expect(
        resolveMapRenderer({
          platform,
          capablePlatforms: capable,
          deviceId: 'hash-1',
          allowed: [],
          blocked: [],
          fallback: 'maplibre',
        }),
      ).toBe('maplibre');
      expect(
        resolveMapRenderer({
          platform,
          capablePlatforms: capable,
          deviceId: 'hash-1',
          allowed: [],
          blocked: [],
          fallback: 'leaflet',
        }),
      ).toBe('leaflet');
      // Allowlisted over a leaflet environment, blocked over a maplibre one.
      expect(
        resolveMapRenderer({
          platform,
          capablePlatforms: capable,
          deviceId: 'hash-1',
          allowed: ['hash-1'],
          blocked: [],
          fallback: 'leaflet',
        }),
      ).toBe('maplibre');
      expect(
        resolveMapRenderer({
          platform,
          capablePlatforms: capable,
          deviceId: 'hash-1',
          allowed: ['hash-1'],
          blocked: ['hash-1'],
          fallback: 'maplibre',
        }),
      ).toBe('leaflet');
    }
  });

  it('refuses a missing or unknown platform instead of trusting the fallback', () => {
    for (const platform of [undefined, '', '   ', 'television', 'web', 'android-tv']) {
      expect(
        resolveMapRenderer({
          platform,
          capablePlatforms: capable,
          deviceId: 'hash-1',
          allowed: ['hash-1'],
          blocked: [],
          fallback: 'maplibre',
        }),
      ).toBe('leaflet');
    }
  });

  it('lets web through when the capability list includes it, so the gate is data', () => {
    expect(
      resolveMapRenderer({
        platform: 'web',
        capablePlatforms: normalizePlatformList('android,ios,web'),
        deviceId: 'hash-1',
        allowed: [],
        blocked: [],
        fallback: 'maplibre',
      }),
    ).toBe('maplibre');
    expect(
      resolveMapRenderer({
        platform: 'web',
        capablePlatforms: ['web'],
        deviceId: undefined,
        allowed: [],
        blocked: [],
        fallback: 'leaflet',
      }),
    ).toBe('leaflet');
  });

  it('treats an empty capability list as nothing being capable', () => {
    for (const platform of ['android', 'ios', 'web']) {
      expect(
        resolveMapRenderer({
          platform,
          capablePlatforms: [],
          deviceId: 'hash-1',
          allowed: ['hash-1'],
          blocked: [],
          fallback: 'maplibre',
        }),
      ).toBe('leaflet');
    }
  });
});
