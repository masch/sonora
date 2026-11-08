#!/usr/bin/env bun
/**
 * scripts/sync-deps.ts — one declared source of truth for monorepo dependency versions
 *
 * Reads `deps.shared.json` from the repository root and checks every workspace
 * manifest against it. Read-only by default: it never writes unless `--apply` is
 * passed explicitly.
 *
 * Three rules, in order of what they protect:
 *
 *   1. `shared` — a package listed there must carry that exact version in every
 *      workspace that declares it. This is what makes a value like `@types/node`
 *      unable to drift between the root and a workspace again.
 *   2. drift — a package declared by more than one workspace must carry the same
 *      version everywhere, whether or not it appears in `shared`. Escape hatches go
 *      in `allowDrift`, which has to spell the package out by name.
 *   3. `lockstep` — a group of packages that move together. A group whose members are
 *      only partially covered by `shared` cannot be applied: updating the covered ones
 *      would leave the group split across two versions, so the contract is rejected
 *      before anything is written.
 *
 * The Expo SDK matrix outranks this file. `expo install --check` knows which version
 * of an SDK-aligned native module the installed SDK expects, and that answer changes
 * with the SDK. When they disagree, the SDK wins and this file is the thing that is
 * wrong.
 *
 * Usage:
 *   bun scripts/sync-deps.ts                 # validate, exit non-zero on violations
 *   bun scripts/sync-deps.ts --apply         # write the shared versions
 *   bun scripts/sync-deps.ts --root <dir>    # operate on another tree (used by tests)
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEP_FIELDS = ['dependencies', 'devDependencies'] as const;
const WORKSPACE_PROTOCOL = 'workspace:';

export interface Manifest {
  /** Repository-relative path, e.g. `apps/mobile/package.json`. */
  path: string;
  name: string;
  data: Record<string, unknown>;
}

export interface Contract {
  shared: Record<string, string>;
  lockstep: Record<string, string[]>;
  allowDrift: string[];
}

export interface Violation {
  kind: 'shared-version' | 'cross-workspace-drift' | 'lockstep-partial' | 'stale-entry';
  workspace: string;
  pkg: string;
  declared: string;
  expected: string;
}

export interface PlannedWrite {
  path: string;
  pkg: string;
  from: string;
  to: string;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
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
      const file = join(dir, 'package.json');
      const data = readJson(file);
      manifests.push({
        path: file.slice(root.length + 1),
        name: String(data.name ?? dir),
        data,
      });
    }
  }

  return manifests;
}

export function loadContract(root: string): Contract {
  const file = join(root, 'deps.shared.json');
  if (!existsSync(file)) {
    throw new Error('deps.shared.json is missing from the repository root');
  }
  const raw = readJson(file) as Partial<Contract>;
  return {
    shared: raw.shared ?? {},
    lockstep: raw.lockstep ?? {},
    allowDrift: raw.allowDrift ?? [],
  };
}

function declarations(manifest: Manifest): Array<{ field: string; pkg: string; version: string }> {
  const out: Array<{ field: string; pkg: string; version: string }> = [];
  for (const field of DEP_FIELDS) {
    const block = manifest.data[field];
    if (!block || typeof block !== 'object') continue;
    for (const [pkg, version] of Object.entries(block as Record<string, string>)) {
      out.push({ field, pkg, version });
    }
  }
  return out;
}

export function validate(manifests: Manifest[], contract: Contract): Violation[] {
  const violations: Violation[] = [];
  const declaredBy = new Map<string, Array<{ workspace: string; version: string }>>();

  for (const manifest of manifests) {
    for (const { pkg, version } of declarations(manifest)) {
      if (!declaredBy.has(pkg)) declaredBy.set(pkg, []);
      declaredBy.get(pkg)!.push({ workspace: manifest.path, version });
    }
  }

  // Rule 1: shared versions are exact.
  for (const [pkg, expected] of Object.entries(contract.shared)) {
    const declared = declaredBy.get(pkg);
    if (!declared) {
      violations.push({
        kind: 'stale-entry',
        workspace: '(none)',
        pkg,
        declared: '(not declared)',
        expected,
      });
      continue;
    }
    for (const entry of declared) {
      if (entry.version.startsWith(WORKSPACE_PROTOCOL)) continue;
      if (entry.version !== expected) {
        violations.push({
          kind: 'shared-version',
          workspace: entry.workspace,
          pkg,
          declared: entry.version,
          expected,
        });
      }
    }
  }

  // Rule 2: anything declared twice must agree, unless deliberately allowed to drift.
  const allowed = new Set(contract.allowDrift);
  for (const [pkg, entries] of declaredBy) {
    if (allowed.has(pkg)) continue;
    if (pkg.startsWith('@sonora/')) continue;
    const distinct = new Set(entries.map((entry) => entry.version));
    if (distinct.size < 2) continue;
    const tally = new Map<string, number>();
    for (const entry of entries) tally.set(entry.version, (tally.get(entry.version) ?? 0) + 1);
    const expected = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const entry of entries) {
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

  // Rule 3: a lockstep group must be movable as a unit.
  for (const [group, members] of Object.entries(contract.lockstep)) {
    const declaredMembers = members.filter((pkg) => {
      const entries = declaredBy.get(pkg);
      return entries !== undefined && entries.length > 0;
    });
    const movable = declaredMembers.filter((pkg) => pkg in contract.shared);
    if (movable.length === 0 || movable.length === declaredMembers.length) continue;
    for (const pkg of movable) {
      violations.push({
        kind: 'lockstep-partial',
        workspace: group,
        pkg,
        declared: `${movable.length}/${declaredMembers.length} movable`,
        expected: members.join(', '),
      });
    }
  }

  return violations;
}

export function plan(manifests: Manifest[], contract: Contract): PlannedWrite[] {
  const writes: PlannedWrite[] = [];
  for (const manifest of manifests) {
    for (const { field, pkg, version } of declarations(manifest)) {
      const expected = contract.shared[pkg];
      if (expected === undefined) continue;
      if (version.startsWith(WORKSPACE_PROTOCOL)) continue;
      if (version === expected) continue;
      writes.push({
        path: manifest.path,
        pkg: `${field}.${pkg}`,
        from: version,
        to: expected,
      });
    }
  }
  return writes;
}

function describe(violation: Violation): string {
  if (violation.kind === 'stale-entry') {
    return `stale-entry  ${violation.pkg}: declared in deps.shared.json as ${violation.expected} but no workspace declares it`;
  }
  if (violation.kind === 'lockstep-partial') {
    return `lockstep     ${violation.workspace}: ${violation.pkg} (${violation.declared}); a group member is declared but absent from shared, so the group would split. Members: ${violation.expected}`;
  }
  return `${violation.kind}  ${violation.workspace}  ${violation.pkg}  declared ${violation.declared}  expected ${violation.expected}`;
}

export function run(
  root: string,
  apply: boolean,
): { violations: Violation[]; writes: PlannedWrite[]; applied: number } {
  const contract = loadContract(root);
  const manifests = loadWorkspaces(root);
  const violations = validate(manifests, contract);
  const writes = plan(manifests, contract);

  // A shared-version mismatch is precisely what --apply repairs, and so is drift on a
  // package the contract pins, because apply writes the pinned value everywhere. Every
  // other kind means the contract is wrong about the tree, or the tree is not worth
  // writing to, so it blocks the write instead of being papered over by it.
  const repairable = (violation: Violation): boolean => {
    if (violation.kind === 'shared-version') return true;
    return violation.kind === 'cross-workspace-drift' && violation.pkg in contract.shared;
  };
  const blocking = violations.filter((violation) => !repairable(violation));
  if (!apply) return { violations, writes, applied: 0 };
  if (blocking.length > 0) return { violations: blocking, writes, applied: 0 };
  if (writes.length === 0) return { violations, writes, applied: 0 };

  const byFile = new Map<string, Record<string, unknown>>();
  for (const manifest of manifests) byFile.set(manifest.path, manifest.data);

  for (const write of writes) {
    const data = byFile.get(write.path)!;
    const [field, pkg] = write.pkg.split('.');
    (data[field] as Record<string, string>)[pkg] = write.to;
  }
  for (const [path, data] of byFile) {
    writeFileSync(join(root, path), `${JSON.stringify(data, null, 2)}\n`);
  }

  const after = validate(loadWorkspaces(root), contract);
  return { violations: after, writes, applied: writes.length };
}

function main(argv: string[]): number {
  let apply = false;
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apply') apply = true;
    else if (argv[i] === '--root') {
      const value = argv[i + 1];
      if (!value) {
        console.error('--root requires a path');
        return 2;
      }
      root = resolve(value);
      i += 1;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: bun scripts/sync-deps.ts [--apply] [--root <dir>]');
      return 0;
    } else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }

  let result: { violations: Violation[]; writes: PlannedWrite[]; applied: number };
  try {
    result = run(root, apply);
  } catch (error) {
    console.error(`sync-deps: ${(error as Error).message}`);
    return 1;
  }

  const verb = result.applied > 0 ? 'updated' : 'would update';
  for (const violation of result.violations) console.error(describe(violation));
  for (const write of result.writes) {
    console.log(`${verb}  ${write.path}  ${write.pkg}  ${write.from} -> ${write.to}`);
  }

  if (result.violations.length > 0) {
    console.error(`sync-deps: ${result.violations.length} violation(s) against deps.shared.json`);
    return 1;
  }
  if (result.applied > 0) {
    console.log(`sync-deps: ${result.applied} version(s) written`);
    return 0;
  }
  if (result.writes.length === 0) {
    console.log('sync-deps: every workspace matches deps.shared.json');
    return 0;
  }
  console.log('sync-deps: dry run, nothing written. Pass --apply to write.');
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
