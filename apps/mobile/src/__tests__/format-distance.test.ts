import { formatDistance } from '@/utils/format-distance';

function mockT(key: string, params?: Record<string, unknown>): string {
  if (key === 'map.distanceKilometers') {
    return `${params?.value} km`;
  }
  if (key === 'map.distanceMeters') {
    return `${params?.value} m`;
  }
  return key;
}

describe('formatDistance', () => {
  it('formats kilometers for >= 1000 meters', () => {
    expect(formatDistance(1500, mockT)).toBe('1.5 km');
  });

  it('formats exact 1000 meters as 1.0 km', () => {
    expect(formatDistance(1000, mockT)).toBe('1.0 km');
  });

  it('formats meters for < 1000', () => {
    expect(formatDistance(500, mockT)).toBe('500 m');
  });

  it('formats 0 meters', () => {
    expect(formatDistance(0, mockT)).toBe('0 m');
  });

  it('formats 1 meter', () => {
    expect(formatDistance(1, mockT)).toBe('1 m');
  });

  it('formats 999 meters', () => {
    expect(formatDistance(999, mockT)).toBe('999 m');
  });

  it('returns fallback text for null meters', () => {
    expect(formatDistance(null, mockT, 'N/A')).toBe('N/A');
  });

  it('returns empty string for null meters without fallback', () => {
    expect(formatDistance(null, mockT)).toBe('');
  });
});
