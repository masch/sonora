import { formatPrice } from '@sonora/shared';

describe('formatPrice', () => {
  it('formats ARS cents to display string', () => {
    const result = formatPrice(15000);
    expect(result).toContain('150,00');
  });

  it('formats small amount correctly', () => {
    const result = formatPrice(500);
    expect(result).toContain('5,00');
  });

  it('formats zero correctly', () => {
    const result = formatPrice(0);
    expect(result).toContain('0,00');
  });

  it('formats single cent', () => {
    const result = formatPrice(1);
    expect(result).toContain('0,01');
  });

  it('formats with explicit ARS currency', () => {
    const result = formatPrice(10000, 'ARS');
    expect(result).toContain('100,00');
  });

  it('formats with USD currency', () => {
    const result = formatPrice(10000, 'USD');
    expect(result).toContain('100');
  });

  it('formats with MXN currency', () => {
    const result = formatPrice(5000, 'MXN');
    expect(result).toContain('50');
  });

  it('respects custom fraction digits', () => {
    const result = formatPrice(15000, 'ARS', { minimumFractionDigits: 0 });
    expect(result).toContain('150');
    expect(result).not.toContain(',');
  });

  it('handles large numbers', () => {
    const result = formatPrice(100000000);
    expect(result).toContain('1.000.000');
    expect(result).toContain('00');
  });

  it('defaults to ARS when no currency given', () => {
    const result = formatPrice(1000);
    // Should still produce a valid formatted currency string
    expect(result).toBeTruthy();
    expect(result).toContain('10');
  });
});
