/**
 * Generic CLI runner for one-time data migrations.
 *
 * Parses --dry-run, connects to the database, calls runMigration(),
 * and prints the report. Used by migration-specific entry points.
 */
import { createInterface } from 'node:readline';
import { Pool } from 'pg';
import { logger } from '@sonora/shared';
import { createDbClient } from '../db';
import { runMigration, formatReport } from './migrate-helpers';
import type { MigrationConfig, MigrationResult } from './migrate-helpers';

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Ask the user a yes/no question via stdin (only works in TTY).
 * Returns true when the user types one of: yes, y, s, si.
 */
export async function askConfirmation(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(['yes', 'y', 's', 'si'].includes(normalized));
    });
  });
}

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

export async function runCli(
  cliConfig: CliConfig,
  migrationConfig: MigrationConfig,
  migrationName: string,
): Promise<{
  result: MigrationResult;
  exitCode: number;
}> {
  if (!cliConfig.connectionString) {
    logger.error('FATAL: DATABASE_URL environment variable is required');
    return {
      result: {
        totalRows: 0,
        rawRows: 0,
        alreadyTargetRows: 0,
        nullRows: 0,
        updatedRows: 0,
        errors: [],
      },
      exitCode: 1,
    };
  }

  logger.info(`🚀 Running migration: ${migrationName}`);

  if (cliConfig.dryRun) {
    logger.info('📋 Dry-run mode — NO changes will be applied');
  } else {
    logger.warn('⚡ LIVE mode — changes WILL be applied to the database');
    logger.warn('');

    // Prompt for confirmation when stdin is a TTY
    if (process.stdin.isTTY) {
      const confirmed = await askConfirmation('Type "yes" to confirm and continue: ');

      if (!confirmed) {
        logger.info('❌ Aborted by user.');
        return {
          result: {
            totalRows: 0,
            rawRows: 0,
            alreadyTargetRows: 0,
            nullRows: 0,
            updatedRows: 0,
            errors: [],
          },
          exitCode: 1,
        };
      }
    }
  }

  logger.info('🔌 Connecting to database ...');

  const pool = new Pool({ connectionString: cliConfig.connectionString });
  const db = createDbClient('pg', pool);

  try {
    const result = await runMigration(db, migrationConfig, cliConfig.dryRun);

    logger.info(formatReport(result));

    if (cliConfig.dryRun && result.rawRows > 0) {
      logger.info('⚠️  Run without --dry-run to apply these changes.');
    }

    const exitCode = result.errors.length > 0 ? 2 : 0;
    return { result, exitCode };
  } finally {
    await pool.end();
  }
}
