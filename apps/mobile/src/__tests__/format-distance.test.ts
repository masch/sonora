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
  it('formats kilometers for >= 1000 and < 10000 meters with 1 decimal', () => {
    expect(formatDistance(1500, mockT)).toBe('1.5 km');
  });

  it('formats exact 1000 meters as 1.0 km', () => {
    expect(formatDistance(1000, mockT)).toBe('1.0 km');
  });

  it('formats kilometers for >= 10000 meters as whole numbers with thousands separator', () => {
    expect(formatDistance(10000, mockT)).toBe('10 km');
    expect(formatDistance(12500, mockT)).toBe('13 km');
    expect(formatDistance(638900, mockT)).toBe('639 km');
    expect(formatDistance(9761400, mockT)).toBe(`${new Intl.NumberFormat().format(9761)} km`);
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

  it('formats decimal meters under 1000 rounding to nearest integer', () => {
    expect(formatDistance(250.4, mockT)).toBe('250 m');
    expect(formatDistance(250.6, mockT)).toBe('251 m');
  });

  it('formats upper range below 10 km with 1 decimal', () => {
    expect(formatDistance(9900, mockT)).toBe('9.9 km');
  });

  it('rounds to nearest whole kilometer above 10 km', () => {
    expect(formatDistance(10400, mockT)).toBe('10 km');
    expect(formatDistance(10600, mockT)).toBe('11 km');
  });

  it('returns fallback text for null or NaN meters', () => {
    expect(formatDistance(null, mockT, 'N/A')).toBe('N/A');
    expect(formatDistance(NaN, mockT, 'N/A')).toBe('N/A');
  });

  it('returns empty string for null or NaN meters without fallback', () => {
    expect(formatDistance(null, mockT)).toBe('');
    expect(formatDistance(NaN, mockT)).toBe('');
  });
});
