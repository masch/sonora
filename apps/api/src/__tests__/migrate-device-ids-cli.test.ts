import { describe, it, expect, afterEach } from 'vitest';
import { parseArgs } from '../scripts/migrate-cli';

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
  it('returns exitCode 1 when DATABASE_URL is missing', async () => {
    const { runCli } = await import('../scripts/migrate-cli');
    const { result, exitCode } = await runCli({
      dryRun: false,
      connectionString: undefined,
    });
    expect(exitCode).toBe(1);
    expect(result.rawRows).toBe(0);
  });
});
