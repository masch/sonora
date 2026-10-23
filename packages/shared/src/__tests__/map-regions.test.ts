import { describe, expect, it } from 'vitest';

import {
  bboxTuple,
  DEFAULT_MAP_REGION,
  isMapRegionKey,
  MAP_REGIONS,
  regionForPoint,
} from '../map/regions';

describe('map regions', () => {
  it('describes every region with a w,s,e,n bbox and a label', () => {
    for (const [key, region] of Object.entries(MAP_REGIONS)) {
      const parts = region.bbox.split(',').map(Number);
      expect(parts, key).toHaveLength(4);
      expect(parts.every(Number.isFinite), key).toBe(true);

      const [west, south, east, north] = parts;
      expect(west, key).toBeLessThan(east);
      expect(south, key).toBeLessThan(north);
      expect(region.label.length, key).toBeGreaterThan(0);
    }
  });

  it('has a default that exists, and a guard that rejects anything else', () => {
    expect(isMapRegionKey(DEFAULT_MAP_REGION)).toBe(true);
    expect(MAP_REGIONS[DEFAULT_MAP_REGION]).toBeDefined();
    expect(isMapRegionKey('otro-valle')).toBe(false);
  });
});

describe('bboxTuple', () => {
  it('turns the published bbox into west, south, east, north numbers', () => {
    // The payload carries numbers, not the string the ingest tooling reads, so
    // the client never parses a bbox and never gets a box it cannot place.
    expect(bboxTuple(MAP_REGIONS.calamuchita.bbox)).toEqual([-64.83, -32.28, -64.66, -32.12]);
    expect(bboxTuple('1,2,3,4')).toEqual([1, 2, 3, 4]);
  });

  it('tolerates surrounding whitespace on each part', () => {
    expect(bboxTuple(' -64.83 , -32.28 , -64.66 , -32.12 ')).toEqual([
      -64.83, -32.28, -64.66, -32.12,
    ]);
  });

  it('returns null for a malformed bbox instead of a box nobody can use', () => {
    const malformed = [
      '',
      '   ',
      '1,2,3',
      '1,2,3,4,5',
      'a,b,c,d',
      '1,2,3,',
      '1,,3,4',
      'NaN,2,3,4',
      'Infinity,2,3,4',
      // Degenerate and inverted boxes: four numbers, but no area to draw.
      '1,2,1,4',
      '3,4,1,2',
      '1,2,3,2',
    ];

    for (const raw of malformed) {
      expect(bboxTuple(raw), raw).toBeNull();
    }
  });
});

describe('regionForPoint', () => {
  /** Two boxes that do not touch: `calamuchita` north-west of `otro-valle`. */
  const catalog = {
    calamuchita: { bbox: [-64.83, -32.28, -64.66, -32.12] as const },
    'otro-valle': { bbox: [-65.5, -33.5, -65.1, -33.1] as const },
  };

  it('resolves the region whose box holds the point', () => {
    expect(regionForPoint(catalog, { latitude: -32.2, longitude: -64.7 })).toBe('calamuchita');
    expect(regionForPoint(catalog, { latitude: -33.3, longitude: -65.3 })).toBe('otro-valle');
  });

  it('counts every edge of the box as inside it', () => {
    // The four edges and the four corners: a point on the boundary belongs to the
    // region, because the published box is what the ingest downloaded.
    const edges = [
      { latitude: -32.2, longitude: -64.83 }, // west
      { latitude: -32.2, longitude: -64.66 }, // east
      { latitude: -32.28, longitude: -64.7 }, // south
      { latitude: -32.12, longitude: -64.7 }, // north
      { latitude: -32.28, longitude: -64.83 }, // south-west corner
      { latitude: -32.12, longitude: -64.83 }, // north-west corner
      { latitude: -32.28, longitude: -64.66 }, // south-east corner
      { latitude: -32.12, longitude: -64.66 }, // north-east corner
    ];

    for (const point of edges) {
      expect(regionForPoint(catalog, point), JSON.stringify(point)).toBe('calamuchita');
    }
  });

  it('resolves nothing for a point just outside the box', () => {
    const outside = [
      { latitude: -32.2, longitude: -64.84 }, // west of it
      { latitude: -32.2, longitude: -64.65 }, // east of it
      { latitude: -32.29, longitude: -64.7 }, // south of it
      { latitude: -32.11, longitude: -64.7 }, // north of it
      { latitude: 0, longitude: 0 },
    ];

    for (const point of outside) {
      expect(regionForPoint(catalog, point), JSON.stringify(point)).toBeNull();
    }
  });

  it('resolves nothing when the catalog publishes no region', () => {
    expect(regionForPoint({}, { latitude: -32.2, longitude: -64.7 })).toBeNull();
  });

  it('resolves nothing without a point to place', () => {
    expect(regionForPoint(catalog, null)).toBeNull();
    expect(regionForPoint(catalog, undefined)).toBeNull();
  });

  it('resolves nothing for a point that is not on the map', () => {
    // A payload with a broken coordinate must not resolve a region by accident:
    // every comparison against NaN is false, so it falls through to none.
    expect(regionForPoint(catalog, { latitude: Number.NaN, longitude: -64.7 })).toBeNull();
    expect(
      regionForPoint(catalog, { latitude: -32.2, longitude: Number.POSITIVE_INFINITY }),
    ).toBeNull();
  });

  it('lets the first region in catalog order win when two boxes overlap', () => {
    // Documented tie-break: the catalog is ordered, and the first key that holds
    // the point answers, so the same point always draws the same archive.
    const overlapping = {
      first: { bbox: [-65, -33, -64, -32] as const },
      second: { bbox: [-64.5, -32.5, -63.5, -31.5] as const },
    };
    const shared = { latitude: -32.4, longitude: -64.4 };

    expect(regionForPoint(overlapping, shared)).toBe('first');
    const reordered = { second: overlapping.second, first: overlapping.first };
    expect(regionForPoint(reordered, shared)).toBe('second');
  });
});
