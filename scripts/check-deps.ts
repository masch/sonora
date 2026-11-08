#!/usr/bin/env bun
/**
 * scripts/check-deps.ts — the checks bun catalogs do not perform
 *
 * Shared versions live in one place: the `catalog` block of the root package.json, which
 * every workspace references as `"catalog:"`. A catalog removes the duplication, but it is
 * a default, not a rule: any workspace may still write a literal version and bun will
 * happily install a different copy. Three rules cover what the catalog cannot:
 *
 *   1. catalog-literal — a workspace that declares a cataloged package with an explicit
 *      version instead of `catalog:`. This is the drift the catalog exists to prevent.
 *   2. cross-workspace-drift — a package declared by more than one workspace with
 *      different versions. The catalog never covers SDK-managed packages such as react,
 *      react-native and the expo family, because `expo install --check` owns those, so
 *      this rule is what keeps them in agreement.
 *   3. stale-catalog — a catalog entry no workspace references, which is a typo or a
 *      package that was removed and left its version behind.
 *
 * Read-only. There is nothing to write: the version lives in the catalog, so fixing a
 * failure means editing the catalog or the manifest by hand.
 *
 * Usage:
 *   bun scripts/check-deps.ts                # validate the repository
 *   bun scripts/check-deps.ts --root <dir>   # validate another tree (used by tests)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEP_FIELDS = ['dependencies', 'devDependencies'] as const;
const WORKSPACE_PROTOCOL = 'workspace:';
const CATALOG_SPECIFIER = 'catalog:';

export interface Manifest {
  /** Repository-relative path, e.g. `apps/mobile/package.json`. */
  path: string;
  name: string;
  data: Record<string, unknown>;
}

export interface Violation {
  kind: 'catalog-literal' | 'cross-workspace-drift' | 'stale-catalog';
  workspace: string;
  pkg: string;
  declared: string;
  expected: string;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

/** The default catalog, declared either at the root or inside the `workspaces` object. */
export function loadCatalog(root: string): Record<string, string> {
  const rootPkg = readJson(join(root, 'package.json'));
  const workspaces = rootPkg.workspaces;
  const nested =
    workspaces && typeof workspaces === 'object' && !Array.isArray(workspaces)
      ? (workspaces as { catalog?: Record<string, string> }).catalog
      : undefined;
  const catalog = (rootPkg.catalog ?? nested) as Record<string, string> | undefined;
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('root package.json declares no `catalog` block');
  }
  return catalog;
}

/** Expands the root `workspaces` globs into manifests. Fails loudly on a dead glob. */
export function loadWorkspaces(root: string): Manifest[] {
  const rootPkg = readJson(join(root, 'package.json'));
  const raw = rootPkg.workspaces;
  const patterns: string[] = Array.isArray(raw)
    ? (raw as string[])
    : raw && typeof raw === 'object' && Array.isArray((raw as { packages?: string[] }).packages)
      ? ((raw as { packages: string[] }).packages as string[])
      : [];

  if (patterns.length === 0) {
    throw new Error('root package.json declares no workspaces');
  }

  const manifests: Manifest[] = [];
  for (const pattern of patterns) {
    const segments = pattern.split('/');
    const last = segments[segments.length - 1];
    const base = join(root, ...segments.slice(0, -1));

    let matches: string[] = [];
    if (last === '*') {
      if (!existsSync(base)) continue;
      matches = readdirSync(base)
        .filter((entry) => statSync(join(base, entry)).isDirectory())
        .filter((entry) => existsSync(join(base, entry, 'package.json')))
        .map((entry) => join(base, entry));
    } else if (existsSync(join(root, pattern))) {
      matches = [join(root, pattern)];
    }

    if (matches.length === 0) {
      throw new Error(`workspace pattern "${pattern}" matched no package.json`);
    }

    for (const dir of matches) {
      const data = readJson(join(dir, 'package.json'));
      manifests.push({
        path: join(dir, 'package.json').slice(root.length + 1),
        name: String(data.name ?? dir),
        data,
      });
    }
  }

  return manifests;
}

function declarations(manifest: Manifest): Array<{ pkg: string; version: string }> {
  const out: Array<{ pkg: string; version: string }> = [];
  for (const field of DEP_FIELDS) {
    const block = manifest.data[field];
    if (!block || typeof block !== 'object') continue;
    for (const [pkg, version] of Object.entries(block as Record<string, string>)) {
      out.push({ pkg, version });
    }
  }
  return out;
}

export function validate(manifests: Manifest[], catalog: Record<string, string>): Violation[] {
  const violations: Violation[] = [];
  const declaredBy = new Map<string, Array<{ workspace: string; version: string }>>();

  for (const manifest of manifests) {
    for (const { pkg, version } of declarations(manifest)) {
      if (!declaredBy.has(pkg)) declaredBy.set(pkg, []);
      declaredBy.get(pkg)!.push({ workspace: manifest.path, version });
    }
  }

  // Rule 1: a cataloged package is referenced, never restated.
  for (const [pkg, entries] of declaredBy) {
    if (!(pkg in catalog)) continue;
    for (const entry of entries) {
      if (entry.version === CATALOG_SPECIFIER) continue;
      violations.push({
        kind: 'catalog-literal',
        workspace: entry.workspace,
        pkg,
        declared: entry.version,
        expected: CATALOG_SPECIFIER,
      });
    }
  }

  // Rule 2: two workspaces may not disagree, which is all that covers SDK-managed packages.
  for (const [pkg, entries] of declaredBy) {
    if (pkg in catalog) continue;
    if (pkg.startsWith('@sonora/')) continue;
    const literals = entries.filter((entry) => !entry.version.startsWith(WORKSPACE_PROTOCOL));
    if (literals.length < 2) continue;
    const distinct = new Set(literals.map((entry) => entry.version));
    if (distinct.size < 2) continue;
    const tally = new Map<string, number>();
    for (const entry of literals) tally.set(entry.version, (tally.get(entry.version) ?? 0) + 1);
    const expected = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const entry of literals) {
      if (entry.version === expected) continue;
      violations.push({
        kind: 'cross-workspace-drift',
        workspace: entry.workspace,
        pkg,
        declared: entry.version,
        expected,
      });
    }
  }

  // Rule 3: the catalog may not carry entries nobody uses.
  for (const pkg of Object.keys(catalog)) {
    if (declaredBy.has(pkg)) continue;
    violations.push({
      kind: 'stale-catalog',
      workspace: '(catalog)',
      pkg,
      declared: '(no workspace declares it)',
      expected: catalog[pkg],
    });
  }

  return violations;
}

function describe(violation: Violation): string {
  if (violation.kind === 'catalog-literal') {
    return `catalog-literal       ${violation.workspace}  ${violation.pkg}  declares ${violation.declared} instead of ${violation.expected}; the version lives in the root catalog, remove it or use "catalog:"`;
  }
  if (violation.kind === 'stale-catalog') {
    return `stale-catalog         ${violation.pkg} is in the root catalog as ${violation.expected} but no workspace declares it`;
  }
  return `cross-workspace-drift ${violation.workspace}  ${violation.pkg}  declared ${violation.declared}  expected ${violation.expected}`;
}

export function run(root: string): Violation[] {
  const catalog = loadCatalog(root);
  return validate(loadWorkspaces(root), catalog);
}

function main(argv: string[]): number {
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      const value = argv[i + 1];
      if (!value) {
        console.error('--root requires a path');
        return 2;
      }
      root = resolve(value);
      i += 1;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: bun scripts/check-deps.ts [--root <dir>]');
      return 0;
    } else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }

  let violations: Violation[];
  try {
    violations = run(root);
  } catch (error) {
    console.error(`check-deps: ${(error as Error).message}`);
    return 1;
  }

  if (violations.length === 0) {
    console.log('check-deps: every workspace agrees with the root catalog');
    return 0;
  }
  for (const violation of violations) console.error(describe(violation));
  console.error(`check-deps: ${violations.length} violation(s)`);
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
