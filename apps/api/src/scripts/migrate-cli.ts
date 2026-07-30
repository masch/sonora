/**
 * CLI argument parsing and orchestration for the device ID migration script.
 *
 * Separated from the entry-point wrapper so it can be unit-tested
 * without the `import.meta.main` guard and the rootDir constraint.
 */
import { Pool } from 'pg';
import { logger } from '@sonora/shared';
import { createDbClient } from '../db';
import { runMigration, formatReport } from './migrate-helpers';
import type { MigrationResult } from './migrate-helpers';

export interface CliConfig {
  dryRun: boolean;
  connectionString: string | undefined;
}

export function parseArgs(argv: string[]): CliConfig {
  return {
    dryRun: argv.includes('--dry-run'),
    connectionString: process.env.DATABASE_URL,
  };
}

export async function runCli(config: CliConfig): Promise<{
  result: MigrationResult;
  exitCode: number;
}> {
  if (!config.connectionString) {
    logger.error('FATAL: DATABASE_URL environment variable is required');
    return {
      result: {
        totalRows: 0,
        rawRows: 0,
        alreadyHashedRows: 0,
        nullRows: 0,
        updatedRows: 0,
        errors: [],
      },
      exitCode: 1,
    };
  }

  logger.info('🔌 Connecting to database ...');
  if (config.dryRun) logger.info('🏃 Dry-run mode — no changes will be applied');

  const pool = new Pool({ connectionString: config.connectionString });
  const db = createDbClient('pg', pool);

  try {
    const result = await runMigration(db, config.dryRun);

    logger.info(formatReport(result));

    if (config.dryRun && result.rawRows > 0) {
      logger.info('⚠️  Run without --dry-run to apply these changes.');
    }

    const exitCode = result.errors.length > 0 ? 2 : 0;
    return { result, exitCode };
  } finally {
    await pool.end();
  }
}
