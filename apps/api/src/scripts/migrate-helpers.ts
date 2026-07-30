/**
 * Pure helper functions for the device ID migration script.
 *
 * Exported so they can be unit-tested independently of the DB connection.
 */
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sha256 } from '@sonora/shared';
import type * as schema from '../db/schema';

// ── Types ────────────────────────────────────────────────────────────

export interface MigrationUpdate {
  table: 'sonora.purchases' | 'sonora.experience_accesses';
  id: string;
  hashed: string;
}

export interface MigrationResult {
  /** Total rows with a device_id (including nulls/empties) */
  totalRows: number;
  /** Rows whose device_id is a raw (unhashed) value */
  rawRows: number;
  /** Rows whose device_id is already a 64-char hex hash */
  alreadyHashedRows: number;
  /** Rows whose device_id is NULL or empty string */
  nullRows: number;
  /** Rows successfully updated (or would-be-updated in dry-run) */
  updatedRows: number;
  /** Errors encountered during updates */
  errors: Array<{ row: unknown; error: string }>;
}

// ── Detection ────────────────────────────────────────────────────────

const HASH_REGEX = /^[0-9a-f]{64}$/i;

/**
 * Returns `true` when `value` is already a SHA-256 hex digest
 * (exactly 64 lowercase/uppercase hex characters).
 */
export function isHashed(value: string | null): boolean {
  if (value === null || value === '') return false;
  return HASH_REGEX.test(value);
}

// ── Core migration logic ─────────────────────────────────────────────

type Row = Record<string, unknown>;

/**
 * Run the full migration: scan both tables, classify each device_id,
 * and optionally apply the UPDATEs.
 *
 * @param db     — A Drizzle `NodePgDatabase` instance
 * @param dryRun — When `true`, count what WOULD be updated without executing
 */
export async function runMigration(
  db: NodePgDatabase<typeof schema>,
  dryRun: boolean,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalRows: 0,
    rawRows: 0,
    alreadyHashedRows: 0,
    nullRows: 0,
    updatedRows: 0,
    errors: [],
  };

  // ── Scan both tables ──────────────────────────────────────────────

  const [purchaseResult, accessResult] = await Promise.all([
    db.execute<Row>(sql`SELECT id, device_id FROM sonora.purchases`),
    db.execute<Row>(sql`SELECT id, device_id FROM sonora.experience_accesses`),
  ]);

  const allRows: Array<{
    id: string;
    device_id: string | null;
    table: 'sonora.purchases' | 'sonora.experience_accesses';
  }> = [
    ...purchaseResult.rows.map((r) => ({
      id: r.id as string,
      device_id: r.device_id as string | null,
      table: 'sonora.purchases' as const,
    })),
    ...accessResult.rows.map((r) => ({
      id: r.id as string,
      device_id: r.device_id as string | null,
      table: 'sonora.experience_accesses' as const,
    })),
  ];

  result.totalRows = allRows.length;

  // ── Classify rows ─────────────────────────────────────────────────

  const updates: MigrationUpdate[] = [];

  for (const row of allRows) {
    if (row.device_id === null || row.device_id === '') {
      result.nullRows++;
    } else if (isHashed(row.device_id)) {
      result.alreadyHashedRows++;
    } else {
      result.rawRows++;
      const hashed = await sha256(row.device_id);
      updates.push({ table: row.table, id: row.id, hashed });
    }
  }

  // ── Apply (or dry-run) ───────────────────────────────────────────

  if (updates.length === 0) {
    return result;
  }

  if (dryRun) {
    result.updatedRows = updates.length;
    return result;
  }

  // Live mode — execute each UPDATE individually so one failure
  // doesn't block the rest (per spec: continue on failure).
  for (const update of updates) {
    try {
      if (update.table === 'sonora.purchases') {
        await db.execute(
          sql`UPDATE sonora.purchases SET device_id = ${update.hashed} WHERE id = ${update.id}`,
        );
      } else {
        await db.execute(
          sql`UPDATE sonora.experience_accesses SET device_id = ${update.hashed} WHERE id = ${update.id}`,
        );
      }
      result.updatedRows++;
    } catch (err) {
      result.errors.push({
        row: { table: update.table, id: update.id },
        error: String(err),
      });
    }
  }

  return result;
}

/**
 * Return a human-readable summary string from a MigrationResult.
 */
export function formatReport(result: MigrationResult): string {
  const lines: string[] = ['── Migration Report ──'];
  lines.push(`  Total rows scanned:  ${result.totalRows}`);
  lines.push(`  NULL/empty:          ${result.nullRows}`);
  lines.push(`  Already hashed:      ${result.alreadyHashedRows}`);
  lines.push(`  Raw (needs hash):    ${result.rawRows}`);
  lines.push(`  Updated:             ${result.updatedRows}`);

  if (result.errors.length > 0) {
    lines.push(`  Errors:              ${result.errors.length}`);
    for (const err of result.errors) {
      lines.push(`    • ${JSON.stringify(err.row)}: ${err.error}`);
    }
  }

  return lines.join('\n');
}
