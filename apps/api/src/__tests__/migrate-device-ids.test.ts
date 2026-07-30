import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHashed, runMigration, formatReport } from '../scripts/migrate-helpers';
import type { MigrationResult } from '../scripts/migrate-helpers';

// ── isHashed ─────────────────────────────────────────────────────────

describe('isHashed', () => {
  it('returns true for a valid 64-char hex SHA-256 hash', () => {
    expect(isHashed('a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b')).toBe(true);
  });

  it('returns true for uppercase hex', () => {
    expect(isHashed('A6896270A62B75EAA63BA4724C236ADC366BD774D53A252437D0759CA314058B')).toBe(true);
  });

  it('returns false for a UUID', () => {
    expect(isHashed('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('returns false for a short hex string', () => {
    expect(isHashed('d6a66d9d0351085d')).toBe(false);
  });

  it('returns false for a raw device ID', () => {
    expect(isHashed('device-abc')).toBe(false);
  });

  it('returns false for an Android ID (hex 64-bit)', () => {
    expect(isHashed('d6a66d9d0351085d')).toBe(false);
  });

  it('returns false for an arbitrary string', () => {
    expect(isHashed('not-a-uuid')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isHashed('12345')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isHashed(null)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isHashed('')).toBe(false);
  });

  it('returns false for a 65-char hex string (too long)', () => {
    expect(isHashed('a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058bc')).toBe(
      false,
    );
  });

  it('returns false for a 63-char hex string (too short)', () => {
    expect(isHashed('a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca31405b')).toBe(false);
  });

  it('returns false for a 64-char string with non-hex character (g)', () => {
    expect(isHashed('g6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b')).toBe(
      false,
    );
  });
});

// ── runMigration ──────────────────────────────────────────────────────

function mockDb(execute: ReturnType<typeof vi.fn>) {
  return { execute } as any;
}

describe('runMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dry-run reports raw rows without executing updates', async () => {
    const execute = vi.fn();
    const db = mockDb(execute);

    // One raw purchase row, empty experience_accesses
    execute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', device_id: 'raw-device-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runMigration(db, true);

    expect(result.totalRows).toBe(1);
    expect(result.rawRows).toBe(1);
    expect(result.nullRows).toBe(0);
    expect(result.alreadyHashedRows).toBe(0);
    expect(result.updatedRows).toBe(1); // would-be update counted
    expect(result.errors).toEqual([]);

    // Should only have executed the two SELECT queries, no UPDATEs
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('live run updates raw rows with SHA-256 hashes', async () => {
    const execute = vi.fn();
    const db = mockDb(execute);

    execute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', device_id: 'raw-device' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined); // UPDATE succeeds

    const result = await runMigration(db, false);

    expect(result.totalRows).toBe(1);
    expect(result.rawRows).toBe(1);
    expect(result.updatedRows).toBe(1);
    expect(result.errors).toEqual([]);

    // 2 SELECTs + 1 UPDATE
    expect(execute).toHaveBeenCalledTimes(3);

    // Verify the UPDATE SQL contains the correct table and ID
    const updateCall = execute.mock.calls[2][0];
    const chunks: unknown[] = updateCall?.queryChunks ?? [];
    const sqlText = chunks
      .map((c: unknown) =>
        typeof c === 'string' ? c : ((c as { value?: string[] })?.value?.[0] ?? ''),
      )
      .join('');
    expect(sqlText).toContain('UPDATE sonora.purchases SET device_id');
    expect(sqlText).toContain('WHERE id');

    // Verify parameters
    const params = chunks.filter((c): c is string => typeof c === 'string');
    // sha256('raw-device') = 2d81f810ddfda22aa4184f660de92e4b50f11f6946ab65593cefe3622472a28e
    expect(params[0]).toBe('2d81f810ddfda22aa4184f660de92e4b50f11f6946ab65593cefe3622472a28e');
    expect(params[1]).toBe('p1');
  });

  it('already-hashed values are left unchanged', async () => {
    const execute = vi.fn();
    const db = mockDb(execute);

    execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'p1',
            device_id: 'a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runMigration(db, false);

    expect(result.totalRows).toBe(1);
    expect(result.rawRows).toBe(0);
    expect(result.alreadyHashedRows).toBe(1);
    expect(result.updatedRows).toBe(0);
    expect(result.errors).toEqual([]);

    // Only SELECTs, no UPDATEs
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('handles both tables simultaneously', async () => {
    const execute = vi.fn();
    const db = mockDb(execute);

    execute
      .mockResolvedValueOnce({ rows: [{ id: 'p1', device_id: 'raw-purchase' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a1', device_id: 'raw-access' }] })
      .mockResolvedValueOnce(undefined) // UPDATE purchase
      .mockResolvedValueOnce(undefined); // UPDATE access

    const result = await runMigration(db, false);

    expect(result.totalRows).toBe(2);
    expect(result.rawRows).toBe(2);
    expect(result.updatedRows).toBe(2);
    expect(result.errors).toEqual([]);

    // 2 SELECTs + 2 UPDATEs
    expect(execute).toHaveBeenCalledTimes(4);

    // First UPDATE on purchases
    const chunks1: unknown[] = execute.mock.calls[2][0]?.queryChunks ?? [];
    const sql1 = chunks1
      .map((c: unknown) =>
        typeof c === 'string' ? c : ((c as { value?: string[] })?.value?.[0] ?? ''),
      )
      .join('');
    expect(sql1).toContain('sonora.purchases');

    // Second UPDATE on experience_accesses
    const chunks2: unknown[] = execute.mock.calls[3][0]?.queryChunks ?? [];
    const sql2 = chunks2
      .map((c: unknown) =>
        typeof c === 'string' ? c : ((c as { value?: string[] })?.value?.[0] ?? ''),
      )
      .join('');
    expect(sql2).toContain('sonora.experience_accesses');
  });

  it('null and empty string device IDs are counted as nullRows', async () => {
    const execute = vi.fn();
    const db = mockDb(execute);

    execute
      .mockResolvedValueOnce({
        rows: [
          { id: 'p1', device_id: null },
          { id: 'p2', device_id: '' },
          { id: 'p3', device_id: 'raw-device' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined); // UPDATE

    const result = await runMigration(db, false);

    expect(result.totalRows).toBe(3);
    expect(result.nullRows).toBe(2);
    expect(result.rawRows).toBe(1);
    expect(result.updatedRows).toBe(1);
  });

  it('error handling continues on UPDATE failure', async () => {
    const execute = vi.fn();
    const db = mockDb(execute);

    const dbError = new Error('connection lost');

    execute
      .mockResolvedValueOnce({
        rows: [
          { id: 'p1', device_id: 'raw-one' },
          { id: 'p2', device_id: 'raw-two' },
          { id: 'p3', device_id: 'raw-three' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined) // UPDATE p1 succeeds
      .mockRejectedValueOnce(dbError) // UPDATE p2 fails
      .mockResolvedValueOnce(undefined); // UPDATE p3 succeeds

    const result = await runMigration(db, false);

    expect(result.totalRows).toBe(3);
    expect(result.rawRows).toBe(3);
    expect(result.updatedRows).toBe(2); // p1 and p3 succeeded
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      row: { table: 'sonora.purchases', id: 'p2' },
      error: 'Error: connection lost',
    });

    // 2 SELECTs + 3 UPDATEs
    expect(execute).toHaveBeenCalledTimes(5);
  });

  it('returns empty result when no rows exist', async () => {
    const execute = vi.fn();
    const db = mockDb(execute);

    execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    const result = await runMigration(db, false);

    expect(result.totalRows).toBe(0);
    expect(result.rawRows).toBe(0);
    expect(result.alreadyHashedRows).toBe(0);
    expect(result.nullRows).toBe(0);
    expect(result.updatedRows).toBe(0);
    expect(result.errors).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

// ── formatReport ──────────────────────────────────────────────────────

describe('formatReport', () => {
  it('formats a result without errors', () => {
    const result: MigrationResult = {
      totalRows: 10,
      rawRows: 3,
      alreadyHashedRows: 5,
      nullRows: 2,
      updatedRows: 3,
      errors: [],
    };

    const output = formatReport(result);
    expect(output).toContain('Total rows scanned:  10');
    expect(output).toContain('NULL/empty:          2');
    expect(output).toContain('Already hashed:      5');
    expect(output).toContain('Raw (needs hash):    3');
    expect(output).toContain('Updated:             3');
    expect(output).not.toContain('Errors:');
  });

  it('formats a result with errors', () => {
    const result: MigrationResult = {
      totalRows: 5,
      rawRows: 5,
      alreadyHashedRows: 0,
      nullRows: 0,
      updatedRows: 4,
      errors: [{ row: { table: 'sonora.purchases', id: 'abc' }, error: 'Error: timeout' }],
    };

    const output = formatReport(result);
    expect(output).toContain('Errors:              1');
    expect(output).toContain('"table":"sonora.purchases"');
    expect(output).toContain('"id":"abc"');
    expect(output).toContain('Error: timeout');
  });
});
