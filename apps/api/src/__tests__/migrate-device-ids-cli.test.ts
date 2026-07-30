import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseArgs } from '../../src/scripts/migrations/migrate-cli';
import type { MigrationConfig } from '../../src/scripts/migrations/migrate-helpers';

// ── Shared test config ─────────────────────────────────────────────────

const TEST_MIGRATION_CONFIG: MigrationConfig = {
  tables: [{ name: 'sonora.test_table', idColumn: 'id', targetColumn: 'value' }],
  detect: (v) => v === 'already-done',
  transform: (v) => Promise.resolve(`hashed:${v}`),
};

const TEST_MIGRATION_NAME = 'Test Migration';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockPoolEnd, mockRunMigration, mockFormatReport, mockDb, MOCK_RESULT, mockQuestion } =
  vi.hoisted(() => {
    const mockPoolEnd = vi.fn().mockResolvedValue(undefined);
    const mockRunMigration = vi.fn();
    const mockFormatReport = vi.fn().mockReturnValue('── Migration Report ──\n  OK');
    const mockDb = { mock: 'db-client' };
    const MOCK_RESULT = {
      totalRows: 10,
      rawRows: 3,
      alreadyTargetRows: 5,
      nullRows: 2,
      updatedRows: 3,
      errors: [],
    };
    const mockQuestion = vi.fn((_p: string, cb: (a: string) => void) => cb('yes'));
    return {
      mockPoolEnd,
      mockRunMigration,
      mockFormatReport,
      mockDb,
      MOCK_RESULT,
      mockQuestion,
    };
  });

vi.mock('pg', () => ({
  Pool: vi.fn(function (this: { end: unknown }) {
    this.end = vi.fn().mockResolvedValue(undefined);
  }),
}));

vi.mock('../db', () => ({
  createDbClient: vi.fn(() => mockDb),
}));

vi.mock('../../src/scripts/migrations/migrate-helpers', () => ({
  runMigration: (...args: unknown[]) => mockRunMigration(...args),
  formatReport: (...args: unknown[]) => mockFormatReport(...args),
}));

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: mockQuestion,
    close: vi.fn(),
  })),
}));

// ── askConfirmation ────────────────────────────────────────────────────

describe('askConfirmation', () => {
  beforeEach(() => {
    mockQuestion.mockReset();
  });

  it('returns true when user types "yes"', async () => {
    mockQuestion.mockImplementation((_p: string, cb: (a: string) => void) => cb('yes'));
    const { askConfirmation } = await import('../../src/scripts/migrations/migrate-cli');
    expect(await askConfirmation('confirm?')).toBe(true);
  });

  it('returns true when user types "y"', async () => {
    mockQuestion.mockImplementation((_p: string, cb: (a: string) => void) => cb('y'));
    const { askConfirmation } = await import('../../src/scripts/migrations/migrate-cli');
    expect(await askConfirmation('confirm?')).toBe(true);
  });

  it('returns true when user types "s"', async () => {
    mockQuestion.mockImplementation((_p: string, cb: (a: string) => void) => cb('s'));
    const { askConfirmation } = await import('../../src/scripts/migrations/migrate-cli');
    expect(await askConfirmation('confirm?')).toBe(true);
  });

  it('returns false when user types anything else', async () => {
    mockQuestion.mockImplementation((_p: string, cb: (a: string) => void) => cb('no'));
    const { askConfirmation } = await import('../../src/scripts/migrations/migrate-cli');
    expect(await askConfirmation('confirm?')).toBe(false);
  });
});

// ── parseArgs ──────────────────────────────────────────────────────────

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

// ── runCli ─────────────────────────────────────────────────────────────

describe('runCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exitCode 1 when DATABASE_URL is missing', async () => {
    const { runCli } = await import('../../src/scripts/migrations/migrate-cli');
    const { result, exitCode } = await runCli(
      { dryRun: false, connectionString: undefined },
      TEST_MIGRATION_CONFIG,
      TEST_MIGRATION_NAME,
    );
    expect(exitCode).toBe(1);
    expect(result.rawRows).toBe(0);
    expect(mockPoolEnd).not.toHaveBeenCalled();
  });

  it('runs migration in dry-run mode and shows warning when raw rows exist', async () => {
    mockRunMigration.mockResolvedValue({ ...MOCK_RESULT });

    const { runCli } = await import('../../src/scripts/migrations/migrate-cli');
    const { result, exitCode } = await runCli(
      { dryRun: true, connectionString: 'postgres://local:5432/sonora' },
      TEST_MIGRATION_CONFIG,
      TEST_MIGRATION_NAME,
    );

    expect(exitCode).toBe(0);
    expect(result.updatedRows).toBe(3);
    expect(mockRunMigration).toHaveBeenCalledWith(mockDb, TEST_MIGRATION_CONFIG, true);
    expect(mockFormatReport).toHaveBeenCalledWith(MOCK_RESULT);
  });

  it('runs migration in live mode (non-TTY, skips prompt)', async () => {
    mockRunMigration.mockResolvedValue({
      ...MOCK_RESULT,
      rawRows: 0,
      updatedRows: 0,
    });

    const { runCli } = await import('../../src/scripts/migrations/migrate-cli');
    const { result, exitCode } = await runCli(
      { dryRun: false, connectionString: 'postgres://local:5432/sonora' },
      TEST_MIGRATION_CONFIG,
      TEST_MIGRATION_NAME,
    );

    expect(exitCode).toBe(0);
    expect(result.updatedRows).toBe(0);
    expect(mockRunMigration).toHaveBeenCalledWith(mockDb, TEST_MIGRATION_CONFIG, false);
  });

  it('runs live mode in TTY with confirmed prompt', async () => {
    const origIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;
    mockQuestion.mockImplementation((_p: string, cb: (a: string) => void) => cb('yes'));

    mockRunMigration.mockResolvedValue({ ...MOCK_RESULT });

    const { runCli } = await import('../../src/scripts/migrations/migrate-cli');
    const { result, exitCode } = await runCli(
      { dryRun: false, connectionString: 'postgres://local:5432/sonora' },
      TEST_MIGRATION_CONFIG,
      TEST_MIGRATION_NAME,
    );

    expect(exitCode).toBe(0);
    expect(result.updatedRows).toBe(3);
    expect(mockQuestion).toHaveBeenCalled();
    process.stdin.isTTY = origIsTTY;
  });

  it('aborts in TTY live mode when user declines', async () => {
    const origIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;
    mockQuestion.mockImplementation((_p: string, cb: (a: string) => void) => cb('no'));

    const { runCli } = await import('../../src/scripts/migrations/migrate-cli');
    const { exitCode } = await runCli(
      { dryRun: false, connectionString: 'postgres://local:5432/sonora' },
      TEST_MIGRATION_CONFIG,
      TEST_MIGRATION_NAME,
    );

    expect(exitCode).toBe(1);
    expect(mockQuestion).toHaveBeenCalled();
    expect(mockPoolEnd).not.toHaveBeenCalled();
    process.stdin.isTTY = origIsTTY;
  });

  it('returns exitCode 2 when migration has errors', async () => {
    mockRunMigration.mockResolvedValue({
      ...MOCK_RESULT,
      errors: [{ row: { id: 'bad-id' }, error: 'Update failed' }],
    });

    const { runCli } = await import('../../src/scripts/migrations/migrate-cli');
    const { exitCode } = await runCli(
      { dryRun: false, connectionString: 'postgres://local:5432/sonora' },
      TEST_MIGRATION_CONFIG,
      TEST_MIGRATION_NAME,
    );

    expect(exitCode).toBe(2);
  });
});
