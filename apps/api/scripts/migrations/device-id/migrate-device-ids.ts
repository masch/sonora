#!/usr/bin/env bun
/**
 * ONE-TIME DATA MIGRATION: SHA-256 hash raw device IDs
 *
 * ── Why this migration exists ──────────────────────────────────────────
 *
 * Before PR #355, the mobile client sent raw platform device IDs (Android
 * ID, iOS vendor ID) as the X-Device-Id header on every API request.
 * The backend hashed them with SHA-256 on arrival, but the raw value
 * was already exposed on the wire.
 *
 * After PR #355, the mobile client hashes the raw ID BEFORE it leaves
 * the device (via expo-crypto). The backend now receives a pre-hashed
 * value and stores it as-is (no double hashing).
 *
 * Existing database records may still contain raw device IDs from before
 * the mobile update. This migration scans those records and replaces any
 * raw value with its SHA-256 digest (same algorithm, same result as the
 * new client-side code).
 *
 * ── What this migration does ──────────────────────────────────────────
 *
 * Tables scanned:
 *   sonora.purchases               (column: device_id)
 *   sonora.experience_accesses      (column: device_id)
 *
 * Detection:
 *   A value is considered "already hashed" if it matches the regex
 *   /^[0-9a-f]{64}$/i (exactly 64 hex characters). Anything else —
 *   UUIDs, short hex strings, arbitrary strings, etc. — is treated as
 *   raw and will be hashed.
 *
 * Transform:
 *   Raw values are SHA-256 hex-digested via @sonora/shared sha256().
 *
 * ── Deployment order ──────────────────────────────────────────────────
 *
 *   1. DDL migration (add platform column)     ← already applied
 *   2. Run this migration (--dry-run first)     ← YOU ARE HERE
 *   3. Deploy updated backend (new middleware)  ← already deployed
 *   4. Deploy updated mobile app                ← already deployed
 *
 * ── Usage ─────────────────────────────────────────────────────────────
 *
 *   bun run scripts/migrate-device-ids.ts           # live run
 *   bun run scripts/migrate-device-ids.ts --dry-run  # dry run, no changes
 *
 * Environment: DATABASE_URL (required)
 *
 * ── Rollback ──────────────────────────────────────────────────────────
 *
 * Rollback order: revert mobile app first, then backend, then run
 * this migration in reverse (un-hash device IDs). Since SHA-256 is
 * one-way, rollback requires restoring from backup or re-populating
 * from mobile client logs.
 */
import { sha256 } from '@sonora/shared';
import { parseArgs, runCli } from '../../../src/scripts/migrations/migrate-cli';
import { isHashed } from '../../../src/scripts/migrations/migrate-helpers';
import type { MigrationConfig } from '../../../src/scripts/migrations/migrate-helpers';

// ── Migration-specific config ─────────────────────────────────────────

const migrationConfig: MigrationConfig = {
  tables: [
    { name: 'sonora.purchases', idColumn: 'id', targetColumn: 'device_id' },
    { name: 'sonora.experience_accesses', idColumn: 'id', targetColumn: 'device_id' },
  ],
  detect: isHashed,
  transform: (value: string) => sha256(value),
};

// ── Entry point ──────────────────────────────────────────────────────

async function main(): Promise<never> {
  const cliConfig = parseArgs(process.argv);
  const { exitCode } = await runCli(cliConfig, migrationConfig, 'Device ID SHA-256 hashing');
  process.exit(exitCode);
}

main();
