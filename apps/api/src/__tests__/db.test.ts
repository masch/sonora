import { describe, it, expect, beforeEach } from 'vitest';
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

  it('returns false for FK violation code 23503', () => {
    // Foreign key violation should NOT be treated as unique violation
    const err = new Error('FK violation') as unknown as Record<string, unknown>;
    err.code = '23503';
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('returns false for FK violation code 23503 in cause', () => {
    const err = new Error('Drizzle FK violation') as unknown as Record<string, unknown>;
    err.cause = { code: '23503' };
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('returns false for an object with empty cause', () => {
    expect(isUniqueViolation({ cause: {} })).toBe(false);
  });
});

import { createDbClient } from '../db';
import { Pool } from 'pg';
import { vi } from 'vitest';

vi.mock('pg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pg')>();
  const MockPool = vi.fn().mockImplementation(
    class {
      connect = vi.fn();
      query = vi.fn();
      end = vi.fn();
    } as unknown as (...args: unknown[]) => unknown,
  );
  return {
    ...actual,
    Pool: MockPool,
  };
});

describe('createDbClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a NodePgDatabase when pg adapter is selected', () => {
    const mockPool = new Pool();
    const client = createDbClient('pg', mockPool);
    expect(client).toBeDefined();
  });

  it('instantiates and caches a single Pool when pg adapter is called with a connection string', () => {
    const connStr = 'postgres://sonora:sonora@localhost:5432/sonora';

    // First call
    const client1 = createDbClient('pg', connStr);
    expect(client1).toBeDefined();
    expect(Pool).toHaveBeenCalledTimes(1); // Mocks are cleared before this test, so it's called 1 time

    // Second call
    const client2 = createDbClient('pg', connStr);
    expect(client2).toBeDefined();
    // Should NOT have called Pool constructor again because of the cache
    expect(Pool).toHaveBeenCalledTimes(1);
  });

  it('creates a NeonHttpDatabase when neon adapter is selected', () => {
    const client = createDbClient('neon', 'postgresql://user:password@localhost/db');
    expect(client).toBeDefined();
  });
});
