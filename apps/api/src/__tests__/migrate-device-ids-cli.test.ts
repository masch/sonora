import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseArgs } from '../scripts/migrate-cli';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockPoolEnd, mockRunMigration, mockFormatReport, mockDb, MOCK_RESULT } = vi.hoisted(() => {
  const mockPoolEnd = vi.fn().mockResolvedValue(undefined);
  const mockRunMigration = vi.fn();
  const mockFormatReport = vi.fn().mockReturnValue('── Migration Report ──\n  OK');
  const mockDb = { mock: 'db-client' };
  const MOCK_RESULT = {
    totalRows: 10,
    rawRows: 3,
    alreadyHashedRows: 5,
    nullRows: 2,
    updatedRows: 3,
    errors: [],
  };
  return { mockPoolEnd, mockRunMigration, mockFormatReport, mockDb, MOCK_RESULT };
});

vi.mock('pg', () => ({
  Pool: vi.fn(function (this: { end: unknown }) {
    this.end = vi.fn().mockResolvedValue(undefined);
  }),
}));

vi.mock('../db', () => ({
  createDbClient: vi.fn(() => mockDb),
}));

vi.mock('../scripts/migrate-helpers', () => ({
  runMigration: (...args: unknown[]) => mockRunMigration(...args),
  formatReport: (...args: unknown[]) => mockFormatReport(...args),
}));

// ── Tests ───────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  const ORIGINAL_ENV = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = ORIGINAL_ENV;
  });

  it('parses dry-run flag from argv', () => {
    const config = parseArgs(['bun', 'scripts/migrate-device-ids.ts', '--dry-run']);
    expect(config.dryRun).toBe(true);
  });

  it('defaults dry-run to false when flag is absent', () => {
    const config = parseArgs(['bun', 'scripts/migrate-device-ids.ts']);
    expect(config.dryRun).toBe(false);
  });

  it('reads DATABASE_URL from environment', () => {
    const url = 'postgres://user:pass@localhost:5432/sonora';
    process.env.DATABASE_URL = url;
    const config = parseArgs(['bun', 'scripts/migrate-device-ids.ts']);
    expect(config.connectionString).toBe(url);
  });

  it('returns undefined connectionString when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    const config = parseArgs(['bun', 'scripts/migrate-device-ids.ts']);
    expect(config.connectionString).toBeUndefined();
  });
});

describe('runCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exitCode 1 when DATABASE_URL is missing', async () => {
    const { runCli } = await import('../scripts/migrate-cli');
    const { result, exitCode } = await runCli({
      dryRun: false,
      connectionString: undefined,
    });
    expect(exitCode).toBe(1);
    expect(result.rawRows).toBe(0);
    expect(mockPoolEnd).not.toHaveBeenCalled();
  });

  it('runs migration in dry-run mode and shows warning when raw rows exist', async () => {
    mockRunMigration.mockResolvedValue({ ...MOCK_RESULT });

    const { runCli } = await import('../scripts/migrate-cli');
    const { result, exitCode } = await runCli({
      dryRun: true,
      connectionString: 'postgres://local:5432/sonora',
    });

    expect(exitCode).toBe(0);
    expect(result.updatedRows).toBe(3);
    expect(mockRunMigration).toHaveBeenCalledWith(mockDb, true);
    expect(mockFormatReport).toHaveBeenCalledWith(MOCK_RESULT);
  });

  it('runs migration in live mode without dry-run warning', async () => {
    mockRunMigration.mockResolvedValue({
      ...MOCK_RESULT,
      rawRows: 0,
      updatedRows: 0,
    });

    const { runCli } = await import('../scripts/migrate-cli');
    const { result, exitCode } = await runCli({
      dryRun: false,
      connectionString: 'postgres://local:5432/sonora',
    });

    expect(exitCode).toBe(0);
    expect(result.updatedRows).toBe(0);
    expect(mockRunMigration).toHaveBeenCalledWith(mockDb, false);
  });

  it('returns exitCode 2 when migration has errors', async () => {
    mockRunMigration.mockResolvedValue({
      ...MOCK_RESULT,
      errors: [{ row: { device_id: 'bad-id' }, error: 'Update failed' }],
    });

    const { runCli } = await import('../scripts/migrate-cli');
    const { exitCode } = await runCli({
      dryRun: false,
      connectionString: 'postgres://local:5432/sonora',
    });

    expect(exitCode).toBe(2);
  });
});
