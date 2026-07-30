import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHashed, runMigration, formatReport } from '../scripts/migrate-helpers';
import type { MigrationConfig, MigrationResult } from '../scripts/migrate-helpers';

// ── Device ID migration config ─────────────────────────────────────────

const DEVICE_ID_CONFIG: MigrationConfig = {
  tables: [
    { name: 'sonora.purchases', idColumn: 'id', targetColumn: 'device_id' },
    { name: 'sonora.experience_accesses', idColumn: 'id', targetColumn: 'device_id' },
  ],
  detect: isHashed,
  transform: (v: string) => Promise.resolve(`sha256:${v}`),
};

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
    const hex65 = 'aa' + '6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b';
    expect(hex65.length).toBe(65);
    expect(isHashed(hex65)).toBe(false);
  });

  it('returns false for a 63-char hex string (too short)', () => {
    const hex63 = 'a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca31405';
    expect(isHashed(hex63)).toBe(false);
  });

  it('returns false for a 64-char string with non-hex character (g)', () => {
    expect(isHashed('a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca31405bg')).toBe(
      false,
    );
  });
});

// ── runMigration ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;
interface ScanResult {
  rows: Row[];
}

function mockScanResult(rows: Row[]): ScanResult {
  return { rows };
}

// Shared mock query state for live-run tests (tracks updates)

const mockExecute = vi.fn();

beforeEach(() => {
  mockExecute.mockReset();
});

describe('runMigration', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('dry-run reports raw rows without executing updates', async () => {
    mockExecute
      .mockResolvedValueOnce(
        mockScanResult([
          { id: '1', device_id: 'raw-device-1' },
          {
            id: '2',
            device_id: 'a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b',
          },
          { id: '3', device_id: null },
        ]),
      )
      .mockResolvedValueOnce(mockScanResult([]));

    const db = { execute: mockExecute } as any;
    const result = await runMigration(db, DEVICE_ID_CONFIG, true);

    expect(result.totalRows).toBe(3);
    expect(result.rawRows).toBe(1);
    expect(result.alreadyTargetRows).toBe(1);
    expect(result.nullRows).toBe(1);
    expect(result.updatedRows).toBe(1);
    // In dry-run, only the 2 SELECTs should execute (no UPDATEs)
    expect(mockExecute.mock.calls.length).toBe(2);
  });

  it('live run updates raw rows with transformed values', async () => {
    mockExecute
      .mockResolvedValueOnce(
        mockScanResult([
          { id: 'p1', device_id: 'raw-val-1' },
          { id: 'p2', device_id: 'raw-val-2' },
        ]),
      )
      .mockResolvedValueOnce(mockScanResult([]))
      .mockResolvedValueOnce(undefined) // UPDATE p1
      .mockResolvedValueOnce(undefined); // UPDATE p2

    const db = { execute: mockExecute } as any;
    const result = await runMigration(db, DEVICE_ID_CONFIG, false);

    expect(result.totalRows).toBe(2);
    expect(result.rawRows).toBe(2);
    expect(result.updatedRows).toBe(2);
    expect(result.alreadyTargetRows).toBe(0);

    // 2 SELECTs + 2 UPDATEs = 4 total calls
    expect(mockExecute.mock.calls.length).toBe(4);
  });

  it('already-hashed values are left unchanged', async () => {
    mockExecute
      .mockResolvedValueOnce(
        mockScanResult([
          {
            id: '1',
            device_id: 'a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b',
          },
        ]),
      )
      .mockResolvedValueOnce(mockScanResult([]));

    const db = { execute: mockExecute } as any;
    const result = await runMigration(db, DEVICE_ID_CONFIG, false);

    expect(result.totalRows).toBe(1);
    expect(result.rawRows).toBe(0);
    expect(result.alreadyTargetRows).toBe(1);
    expect(result.updatedRows).toBe(0);
  });

  it('handles both tables simultaneously', async () => {
    // purchases: 1 raw row
    // experience_accesses: 1 raw row
    mockExecute
      .mockResolvedValueOnce(mockScanResult([{ id: 'p1', device_id: 'purchase-raw' }]))
      .mockResolvedValueOnce(mockScanResult([{ id: 'a1', device_id: 'access-raw' }]))
      .mockResolvedValueOnce(undefined) // UPDATE purchases
      .mockResolvedValueOnce(undefined); // UPDATE experience_accesses

    const db = { execute: mockExecute } as any;
    const result = await runMigration(db, DEVICE_ID_CONFIG, false);

    expect(result.totalRows).toBe(2);
    expect(result.rawRows).toBe(2);
    expect(result.updatedRows).toBe(2);

    // 2 SELECTs + 2 UPDATEs = 4 total calls
    expect(mockExecute.mock.calls.length).toBe(4);
  });

  it('null and empty string device IDs are counted as nullRows', async () => {
    mockExecute
      .mockResolvedValueOnce(
        mockScanResult([
          { id: '1', device_id: null },
          { id: '2', device_id: '' },
          {
            id: '3',
            device_id: 'a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b',
          },
        ]),
      )
      .mockResolvedValueOnce(mockScanResult([]));

    const db = { execute: mockExecute } as any;
    const result = await runMigration(db, DEVICE_ID_CONFIG, false);

    expect(result.totalRows).toBe(3);
    expect(result.nullRows).toBe(2);
    expect(result.rawRows).toBe(0);
    expect(result.alreadyTargetRows).toBe(1);
    expect(result.updatedRows).toBe(0);
  });

  it('error handling continues on UPDATE failure', async () => {
    mockExecute
      .mockResolvedValueOnce(
        mockScanResult([
          { id: 'p1', device_id: 'raw-1' },
          { id: 'p2', device_id: 'raw-2' },
          { id: 'p3', device_id: 'raw-3' },
        ]),
      )
      .mockResolvedValueOnce(mockScanResult([]))
      .mockResolvedValueOnce(undefined) // UPDATE p1 succeeds
      .mockRejectedValueOnce(new Error('DB error')) // UPDATE p2 fails
      .mockResolvedValueOnce(undefined); // UPDATE p3 succeeds

    const db = { execute: mockExecute } as any;
    const result = await runMigration(db, DEVICE_ID_CONFIG, false);

    expect(result.totalRows).toBe(3);
    expect(result.rawRows).toBe(3);
    expect(result.updatedRows).toBe(2); // 2 succeeded, 1 failed
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toHaveProperty('row');
    expect(result.errors[0].error).toContain('DB error');
  });

  it('returns empty result when no rows exist', async () => {
    mockExecute.mockResolvedValueOnce(mockScanResult([])).mockResolvedValueOnce(mockScanResult([]));

    const db = { execute: mockExecute } as any;
    const result = await runMigration(db, DEVICE_ID_CONFIG, false);

    expect(result.totalRows).toBe(0);
    expect(result.rawRows).toBe(0);
    expect(result.alreadyTargetRows).toBe(0);
    expect(result.nullRows).toBe(0);
    expect(result.updatedRows).toBe(0);
    expect(result.errors).toEqual([]);
  });
});

// ── formatReport ───────────────────────────────────────────────────────

describe('formatReport', () => {
  it('formats a result without errors', () => {
    const result: MigrationResult = {
      totalRows: 10,
      rawRows: 3,
      alreadyTargetRows: 5,
      nullRows: 2,
      updatedRows: 3,
      errors: [],
    };

    const output = formatReport(result);
    expect(output).toContain('Total rows scanned:  10');
    expect(output).toContain('NULL/empty:          2');
    expect(output).toContain('Already in target:   5');
    expect(output).toContain('Raw (to transform):  3');
    expect(output).toContain('Updated:             3');
  });

  it('formats a result with errors', () => {
    const result: MigrationResult = {
      totalRows: 3,
      rawRows: 3,
      alreadyTargetRows: 0,
      nullRows: 0,
      updatedRows: 2,
      errors: [{ row: { id: 'p1' }, error: 'Update failed' }],
    };

    const output = formatReport(result);
    expect(output).toContain('Errors:              1');
    expect(output).toContain('"id":"p1"');
    expect(output).toContain('Update failed');
  });
});
