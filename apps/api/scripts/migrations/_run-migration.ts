#!/usr/bin/env bun
/**
 * Interactive migration runner.
 *
 * Lists available migrations (subdirectories containing migrate-*.ts)
 * when no argument is provided, otherwise runs the specified one.
 *
 * Usage:
 *   bun run scripts/migrations/_run-migration.ts              # list
 *   bun run scripts/migrations/_run-migration.ts device-id    # run
 *   bun run scripts/migrations/_run-migration.ts device-id --dry-run
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const SELF_DIR = dirname(new URL(import.meta.url).pathname);
const MIGRATION_PREFIX = 'migrate-';
const ENTRY_FILE_SUFFIX = '.ts';

interface Migration {
  name: string;
  dirname: string;
  entryFile: string;
}

function findMigrations(dir: string): Migration[] {
  const entries = readdirSync(dir);
  const result: Migration[] = [];

  for (const entry of entries) {
    const entryPath = resolve(dir, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    const files = readdirSync(entryPath);
    const entryFile = files.find(
      (f) => f.startsWith(MIGRATION_PREFIX) && f.endsWith(ENTRY_FILE_SUFFIX),
    );
    if (!entryFile) continue;

    result.push({
      name: entryFile.replace(/\.ts$/, ''),
      dirname: entry,
      entryFile,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function listAndExit(migrations: Migration[], message?: string): never {
  if (message) console.error(`\n❌ ${message}\n`);
  console.log('📋 Available migrations:\n');
  for (const m of migrations) {
    console.log(`  ${m.dirname}/  →  ${m.entryFile}`);
  }
  console.log('\nUsage:');
  console.log(`  make db-migrate-local MIGRATION=<dirname>             # dry-run (default)`);
  console.log(`  make db-migrate-local MIGRATION=<dirname> LIVE=1      # live`);
  console.log('');
  process.exit(1);
}

const migrationArg = process.argv[2] ?? '';
const migrations = findMigrations(SELF_DIR);

if (!migrationArg) {
  listAndExit(migrations);
}

// Accept bare dirname or dirname/migrate-xxx.ts
const parts = migrationArg.replace(/\/migrate-.*\.ts$/, '').replace(/\/$/, '');
const dirPath = resolve(SELF_DIR, parts);

if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
  listAndExit(migrations, `Migration "${migrationArg}" not found`);
}

const dirFiles = readdirSync(dirPath);
const entryFile = dirFiles.find(
  (f) => f.startsWith(MIGRATION_PREFIX) && f.endsWith(ENTRY_FILE_SUFFIX),
);

if (!entryFile) {
  listAndExit(migrations, `No migration entry file found in "${parts}/"`);
}

const entryPath = resolve(dirPath, entryFile);

const result = spawnSync('bun', ['run', entryPath, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env },
});

process.exit(result.status ?? 1);
