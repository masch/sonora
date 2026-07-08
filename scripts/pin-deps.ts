/**
 * scripts/pin-deps.ts — One-time version pinning script
 *
 * Reads resolved versions from node_modules/<package>/package.json and
 * replaces all range constraints (^, ~, *) with exact pinned versions
 * across the four target workspace package.json files.
 *
 * Usage: bun run scripts/pin-deps.ts
 * Requires: bun install has been run (node_modules populated)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PkgJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const ROOT = resolve(__dirname, '..');

const TARGET_FILES = [
  'apps/api/package.json',
  'apps/mobile/package.json',
  'apps/admin/package.json',
  'packages/shared/package.json',
] as const;

const RESOLVED_NAME_MAP: Record<string, string> = {
  // Only for packages where node_modules resolution is unreliable
  // (e.g., re-exported or hoisted oddly in bun workspaces).
  // Most packages resolve correctly from node_modules.
};

/**
 * Resolve the exact installed version of a package from node_modules.
 * Tries the target file's own node_modules first, then workspace root.
 */
function resolveVersion(packageName: string, cwd: string): string | null {
  // Explicit override for packages that can't be resolved from node_modules
  if (RESOLVED_NAME_MAP[packageName]) {
    return RESOLVED_NAME_MAP[packageName];
  }

  // Try relative to the target file's directory
  try {
    const pkgPath = resolve(cwd, 'node_modules', packageName, 'package.json');
    const content = readFileSync(pkgPath, 'utf-8');
    const { version } = JSON.parse(content) as { version?: string };
    if (version) return version;
  } catch {
    // Fall through to next strategy
  }

  // Try workspace root node_modules
  try {
    const rootPkgPath = resolve(ROOT, 'node_modules', packageName, 'package.json');
    const content = readFileSync(rootPkgPath, 'utf-8');
    const { version } = JSON.parse(content) as { version?: string };
    if (version) return version;
  } catch {
    // Not found
  }

  return null;
}

/**
 * Check if a version string contains a range specifier (^, ~, or *).
 */
function isRangeConstraint(version: string): boolean {
  return version === '*' || /^[\^~]/.test(version);
}

/**
 * Check that no range specifiers remain in the target files after pinning.
 */
function validateNoRanges(files: string[]): boolean {
  let allClean = true;

  for (const file of files) {
    const absPath = resolve(ROOT, file);
    const content = readFileSync(absPath, 'utf-8');
    const pkg: PkgJson = JSON.parse(content);

    const check = (deps: Record<string, string> | undefined) => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        if (version === 'workspace:*') continue;
        if (isRangeConstraint(version)) {
          process.stderr.write(
            `FAIL: ${file} → ${name}: "${version}" still has a range specifier\n`,
          );
          allClean = false;
        }
      }
    };

    check(pkg.dependencies);
    check(pkg.devDependencies);
  }

  return allClean;
}

function main(): void {
  let changedCount = 0;
  const changes: string[] = [];

  for (const relPath of TARGET_FILES) {
    const absPath = resolve(ROOT, relPath);
    const cwd = resolve(ROOT, relPath, '..');
    const content = readFileSync(absPath, 'utf-8');
    const pkg: PkgJson = JSON.parse(content);

    let modified = false;

    const pinDeps = (deps: Record<string, string> | undefined) => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        if (version === 'workspace:*') continue;
        if (!isRangeConstraint(version)) continue;

        const exact = resolveVersion(name, cwd);
        if (!exact) {
          process.stderr.write(`ERROR: Cannot resolve version for "${name}" (${relPath})\n`);
          process.exit(1);
        }

        deps[name] = exact;
        modified = true;
        changedCount++;
        changes.push(`${relPath}: ${name} ${version} → ${exact}`);
      }
    };

    pinDeps(pkg.dependencies);
    pinDeps(pkg.devDependencies);

    if (modified) {
      writeFileSync(absPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');
    }
  }

  process.stdout.write(
    `\nPinned ${changedCount} version constraints across ${TARGET_FILES.length} files:\n`,
  );
  for (const c of changes) {
    process.stdout.write(`  ${c}\n`);
  }

  process.stdout.write('\n--- Validation ---\n');
  process.stdout.write('Checking for remaining range specifiers...\n');
  if (!validateNoRanges([...TARGET_FILES])) {
    process.stderr.write('ERROR: Some range specifiers remain after pinning.\n');
    process.exit(1);
  }
  process.stdout.write('  All dependencies are pinned to exact versions ✓\n');
  process.stdout.write('Pinning complete.\n');
}

main();
