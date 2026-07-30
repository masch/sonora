#!/usr/bin/env bun
/**
 * One-time data migration: SHA-256 hash raw device IDs in the database.
 *
 * Scans `sonora.purchases.device_id` and `sonora.experience_accesses.device_id`,
 * detects values that are NOT already 64-char hex hashes, and replaces them
 * with their SHA-256 digest.
 *
 * Usage:
 *   bun run scripts/migrate-device-ids.ts           # live run
 *   bun run scripts/migrate-device-ids.ts --dry-run  # dry run (no changes)
 *
 * Environment:
 *   DATABASE_URL — PostgreSQL connection string (required)
 */
import { Pool } from 'pg';
import { createDbClient } from '../src/db';
import { runMigration, formatReport } from '../src/scripts/migrate-helpers';

async function main(): Promise<never> {
  // ── Parse args ──────────────────────────────────────────────────

  const dryRun = process.argv.includes('--dry-run');
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('FATAL: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // ── Connect ─────────────────────────────────────────────────────

  console.log(`🔌 Connecting to database ...`);
  if (dryRun) console.log('🏃 Dry-run mode — no changes will be applied\n');

  const pool = new Pool({ connectionString });
  const db = createDbClient('pg', pool);

  // ── Run migration ────────────────────────────────────────────────

  try {
    const result = await runMigration(db, dryRun);

    console.log(formatReport(result));

    if (dryRun && result.rawRows > 0) {
      console.log('\n⚠️  Run without --dry-run to apply these changes.');
    }

    if (result.errors.length > 0) {
      process.exit(2);
    }

    process.exit(0);
  } finally {
    await pool.end();
  }
}

main();
