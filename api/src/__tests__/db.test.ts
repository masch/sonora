import { describe, it, expect } from 'vitest';
import { isUniqueViolation } from '../index';

describe('isUniqueViolation', () => {
  it('returns true when error has code 23505 directly', () => {
    const err = new Error('duplicate key') as unknown as Record<string, unknown>;
    err.code = '23505';
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('returns true when error has code 23505 in cause', () => {
    const err = new Error('Drizzle query failed') as unknown as Record<string, unknown>;
    err.cause = { code: '23505' };
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('returns false when error has a different code', () => {
    const err = new Error('connection refused') as unknown as Record<string, unknown>;
    err.code = 'ECONNREFUSED';
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('returns false when error has a different code in cause', () => {
    const err = new Error('query failed') as unknown as Record<string, unknown>;
    err.cause = { code: '42P01' }; // undefined_table
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isUniqueViolation('error')).toBe(false);
  });

  it('returns false for an object with no code property', () => {
    expect(isUniqueViolation({ message: 'something broke' })).toBe(false);
  });

  it('returns false for an object with empty cause', () => {
    expect(isUniqueViolation({ cause: {} })).toBe(false);
  });
});
