#!/usr/bin/env bun
/**
 * Sync translations from DB back into .ts locale files.
 *
 * Usage:
 *   bun run apps/api/scripts/sync-translations.ts [options]
 *
 * Options:
 *   --api-url  <url>    API base URL (default: from env API_URL or http://localhost:3001)
 *   --api-key  <key>    Admin API key (default: from env ADMIN_API_KEY)
 *   --dry-run           Print diff without writing files
 *
 * Flow:
 *   1. Read mobile .ts locale files (en, es)
 *   2. Flatten them to dot-notation
 *   3. Fetch DB overrides from API
 *   4. Deep-merge DB values into locale objects (DB wins)
 *   5. Write updated .ts files (or print diff in dry-run mode)
 *   6. Exit 0 if no changes, 1 if changes made
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  flatten,
  setNested,
  serializeToTS,
  renderTSFile,
  diffFlat,
} from '../src/scripts/sync-helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const LOCALES_DIR = resolve(ROOT, 'apps/mobile/src/i18n/locales');

// ── Parse args ──────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const API_URL = getArg('--api-url') || process.env.API_URL || 'http://localhost:3001';
const API_KEY = getArg('--api-key') || process.env.ADMIN_API_KEY || '';
const DRY_RUN = args.includes('--dry-run');

// ── Read locale files ───────────────────────────────────────

async function readLocale(lang: string): Promise<Record<string, unknown>> {
  const filePath = resolve(LOCALES_DIR, `${lang}.ts`);
  const mod = await import(filePath);
  return mod[lang] as Record<string, unknown>;
}

// ── Fetch DB overrides from API ─────────────────────────────

async function fetchOverrides(lang: string): Promise<Record<string, string>> {
  const url = `${API_URL}/api/translations/${lang}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<Record<string, string>>;
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<number> {
  console.log(`📖 Reading locale files from ${LOCALES_DIR}`);
  console.log(`🌐 API: ${API_URL}`);
  console.log(`🔑 API key: ${API_KEY ? '***' : '(none)'}`);
  if (DRY_RUN) console.log('🏃 Dry-run mode (no files will be written)\n');

  const SUPPORTED_LANGS = ['en', 'es'];
  let totalChanges = 0;

  for (const lang of SUPPORTED_LANGS) {
    console.log(`\n── ${lang.toUpperCase()} ──`);

    // 1. Read .ts file
    const localeObj = await readLocale(lang);
    const flatBase = flatten(localeObj);

    // 2. Fetch DB overrides
    let flatOverrides: Record<string, string> = {};
    try {
      flatOverrides = await fetchOverrides(lang);
    } catch (err) {
      console.warn(`  ⚠️  Could not fetch DB overrides: ${err}`);
      continue;
    }

    // 3. Diff
    const diff = diffFlat(flatBase, flatOverrides);

    if (Object.keys(diff).length === 0) {
      console.log(`  ✅ No changes for ${lang}`);
      continue;
    }

    console.log(`  📝 ${Object.keys(diff).length} key(s) differ:`);
    for (const [key, { base, overlay }] of Object.entries(diff)) {
      console.log(`    • ${key}: '${base}' → '${overlay}'`);
    }

    // 4. Merge DB overrides into locale object
    const merged = structuredClone(localeObj);
    for (const [key, value] of Object.entries(flatOverrides)) {
      if (flatBase[key] !== value) {
        setNested(merged as Record<string, unknown>, key, value);
      }
    }

    // 5. Write updated .ts file (or dry-run)
    const content = renderTSFile(lang, merged);

    if (DRY_RUN) {
      console.log(`\n  📄 Updated ${lang}.ts:\n${content}`);
    } else {
      const filePath = resolve(LOCALES_DIR, `${lang}.ts`);
      writeFileSync(filePath, content);
      // Run prettier to normalize formatting — ensures clean diffs
      execSync(`bunx prettier --write "${filePath}"`, { stdio: 'inherit' });
      console.log(`  ✅ Wrote ${filePath}`);
    }

    totalChanges += Object.keys(diff).length;
  }

  console.log(`\n── Summary ──`);
  if (totalChanges > 0) {
    console.log(`🔶 ${totalChanges} translation(s) differ from DB.`);
    if (!DRY_RUN) console.log('✅ Locale files updated with DB overrides.');
    return 1; // Signal: changes made
  }

  console.log('✅ All translations match DB. No changes needed.');
  return 0; // Signal: no changes
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(2);
  });
