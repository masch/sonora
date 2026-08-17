import { describe, it, expect } from 'vitest';
import { haversineDistance } from './proximity';

describe('haversineDistance', () => {
  it('should return 0 for the exact same coordinates', () => {
    const lat = -31.979;
    const lon = -64.635;
    expect(haversineDistance(lat, lon, lat, lon)).toBe(0);
  });

  it('should calculate distance correctly between two known points', () => {
    // Coordinate A (Base) and B (Sendero) in Umepay area
    const lat1 = -31.979027;
    const lon1 = -64.635817;
    const lat2 = -31.979928;
    const lon2 = -64.634123;

    const distance = haversineDistance(lat1, lon1, lat2, lon2);
    // Calculated standard: ~188 meters
    expect(distance).toBeGreaterThan(180);
    expect(distance).toBeLessThan(200);
  });
});
