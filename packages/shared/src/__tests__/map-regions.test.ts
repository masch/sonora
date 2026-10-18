import { describe, expect, it } from 'vitest';

import { DEFAULT_MAP_REGION, isMapRegionKey, MAP_REGIONS } from '../map/regions';

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
