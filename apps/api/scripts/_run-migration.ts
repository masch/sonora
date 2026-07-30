#!/usr/bin/env bun
/**
 * Interactive migration runner.
 *
 * Lists available migrate-*.ts scripts when no argument is provided,
 * otherwise runs the specified migration in the same directory.
 *
 * Usage:
 *   bun run scripts/_run-migration.ts                          # list
 *   bun run scripts/_run-migration.ts migrate-device-ids.ts    # run
 *   bun run scripts/_run-migration.ts migrate-device-ids.ts --dry-run
 */
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const SELF_DIR = dirname(new URL(import.meta.url).pathname);
const MIGRATION_PREFIX = 'migrate-';

interface Migration {
  name: string;
  filename: string;
}

function findMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.startsWith(MIGRATION_PREFIX) && f.endsWith('.ts'))
    .map((f) => ({
      name: f.replace(/\.ts$/, ''),
      filename: f,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listAndExit(migrations: Migration[], message?: string): never {
  if (message) console.error(`\n❌ ${message}\n`);
  console.log('📋 Available migrations:\n');
  for (const m of migrations) {
    console.log(`  ${m.filename}`);
  }
  console.log('\nUsage:');
  console.log(`  make db-migrate-local MIGRATION=<filename>        # dry-run (default)`);
  console.log(`  make db-migrate-local MIGRATION=<filename> LIVE=1 # live`);
  console.log('');
  process.exit(1);
}

const migrationArg = process.argv[2] ?? '';
const migrations = findMigrations(SELF_DIR);

if (!migrationArg) {
  listAndExit(migrations);
}

const migrationPath = resolve(SELF_DIR, migrationArg);

if (!existsSync(migrationPath)) {
  listAndExit(migrations, `Migration "${migrationArg}" not found`);
}

const result = spawnSync('bun', ['run', migrationPath, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env },
});

process.exit(result.status ?? 1);
