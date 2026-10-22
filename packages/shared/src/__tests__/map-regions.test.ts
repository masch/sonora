import { describe, expect, it } from 'vitest';

import { bboxTuple, DEFAULT_MAP_REGION, isMapRegionKey, MAP_REGIONS } from '../map/regions';

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
