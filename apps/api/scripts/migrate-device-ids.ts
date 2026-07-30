#!/usr/bin/env bun
/**
 * One-time data migration: SHA-256 hash raw device IDs in the database.
 *
 * Entry point — delegates to src/scripts/migrate-cli.ts for testable logic.
 *
 * Usage:
 *   bun run scripts/migrate-device-ids.ts           # live run
 *   bun run scripts/migrate-device-ids.ts --dry-run  # dry run (no changes)
 *
 * Environment:
 *   DATABASE_URL — PostgreSQL connection string (required)
 */
import { parseArgs, runCli } from '../src/scripts/migrate-cli';

async function main(): Promise<never> {
  const config = parseArgs(process.argv);
  const { exitCode } = await runCli(config);
  process.exit(exitCode);
}

main();
