/**
 * Generic helpers for one-time data migrations.
 *
 * Provides reusable patterns: scan tables, classify rows, dry-run, report.
 * Each migration provides its own config: tables, columns, detect/transform functions.
 */
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../db/schema';

// ── Types ────────────────────────────────────────────────────────────

export interface MigrationTable {
  /** Fully qualified table name (e.g. 'sonora.purchases') */
  name: string;
  /** Primary key column */
  idColumn: string;
  /** Column to scan and transform */
  targetColumn: string;
}

export interface MigrationConfig {
  /** Tables to scan */
  tables: MigrationTable[];
  /** Returns true when the value is already in the target form (skip) */
  detect: (value: string | null) => boolean;
  /** Transforms a raw value into the target form */
  transform: (value: string) => Promise<string>;
}

export interface MigrationResult {
  totalRows: number;
  rawRows: number;
  alreadyTargetRows: number;
  nullRows: number;
  updatedRows: number;
  errors: Array<{ row: unknown; error: string }>;
}

// ── Utilities ──────────────────────────────────────────────────────

const HASH_REGEX = /^[0-9a-f]{64}$/i;

/**
 * Returns true when value is already a SHA-256 hex digest
 * (exactly 64 lowercase/uppercase hex characters).
 * Useful for migration detect functions.
 */
export function isHashed(value: string | null): boolean {
  if (value === null || value === '') return false;
  return HASH_REGEX.test(value);
}

// ── Core runner ──────────────────────────────────────────────────────

/**
 * Run a generic data migration: scan tables, classify rows, apply updates.
 *
 * @param db     — Drizzle `NodePgDatabase` instance
 * @param config — Migration config (tables, detect, transform)
 * @param dryRun — When true, count would-be changes without executing
 */
export async function runMigration(
  db: NodePgDatabase<typeof schema>,
  config: MigrationConfig,
  dryRun: boolean,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalRows: 0,
    rawRows: 0,
    alreadyTargetRows: 0,
    nullRows: 0,
    updatedRows: 0,
    errors: [],
  };

  // ── Scan all tables ────────────────────────────────────────────────

  const scans = config.tables.map((table) =>
    db.execute<Record<string, unknown>>(
      sql.raw(`SELECT ${table.idColumn}, ${table.targetColumn} FROM ${table.name}`),
    ),
  );

  const scanResults = await Promise.all(scans);

  interface Row {
    id: string;
    value: string | null;
    table: string;
  }

  const allRows: Row[] = [];
  for (let i = 0; i < config.tables.length; i++) {
    const table = config.tables[i];
    for (const row of scanResults[i].rows) {
      allRows.push({
        id: row[table.idColumn] as string,
        value: row[table.targetColumn] as string | null,
        table: table.name,
      });
    }
  }

  result.totalRows = allRows.length;

  // ── Classify ───────────────────────────────────────────────────────

  const updates: Array<{ table: string; id: string; transformed: string }> = [];

  for (const row of allRows) {
    if (row.value === null || row.value === '') {
      result.nullRows++;
    } else if (config.detect(row.value)) {
      result.alreadyTargetRows++;
    } else {
      result.rawRows++;
      const transformed = await config.transform(row.value);
      updates.push({ table: row.table, id: row.id, transformed });
    }
  }

  if (updates.length === 0) return result;

  if (dryRun) {
    result.updatedRows = updates.length;
    return result;
  }

  // ── Apply ──────────────────────────────────────────────────────────

  for (const update of updates) {
    try {
      const table = config.tables.find((t) => t.name === update.table)!;
      await db.execute(
        sql.raw(
          `UPDATE ${table.name} SET ${table.targetColumn} = '${update.transformed}' WHERE ${table.idColumn} = '${update.id}'`,
        ),
      );
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

// ── Report ───────────────────────────────────────────────────────────

/**
 * Return a human-readable summary string from a MigrationResult.
 */
export function formatReport(result: MigrationResult): string {
  const lines: string[] = ['── Migration Report ──'];
  lines.push(`  Total rows scanned:  ${result.totalRows}`);
  lines.push(`  NULL/empty:          ${result.nullRows}`);
  lines.push(`  Already in target:   ${result.alreadyTargetRows}`);
  lines.push(`  Raw (to transform):  ${result.rawRows}`);
  lines.push(`  Updated:             ${result.updatedRows}`);

  if (result.errors.length > 0) {
    lines.push(`  Errors:              ${result.errors.length}`);
    for (const err of result.errors) {
      lines.push(`    • ${JSON.stringify(err.row)}: ${err.error}`);
    }
  }

  return lines.join('\n');
}
