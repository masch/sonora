import { describe, it, expect } from 'vitest';
import { isUniqueViolation } from '../db-errors';

describe('isUniqueViolation', () => {
  it('returns true for error code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('returns true for nested cause code 23505', () => {
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
  });

  it('returns false for other codes', () => {
    expect(isUniqueViolation({ code: '12345' })).toBe(false);
    expect(isUniqueViolation({ cause: { code: '12345' } })).toBe(false);
  });

  it('returns false for non-object or null values', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('string error')).toBe(false);
    expect(isUniqueViolation(123)).toBe(false);
  });
});
