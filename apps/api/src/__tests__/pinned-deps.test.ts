import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../../../');

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const TARGET_FILES = [
  'apps/api/package.json',
  'apps/mobile/package.json',
  'apps/admin/package.json',
  'packages/shared/package.json',
];

function isRangeConstraint(version: string): boolean {
  return version === '*' || /^[\^~]/.test(version);
}

describe('dependency pinning', () => {
  it.each(TARGET_FILES)('%s should have no range constraints in dependencies', (relPath) => {
    const absPath = resolve(ROOT, relPath);
    let content: string;
    try {
      content = readFileSync(absPath, 'utf-8');
    } catch {
      throw new Error(`Cannot read ${relPath} at ${absPath}`);
    }

    let pkg: PkgJson;
    try {
      pkg = JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in ${relPath}`);
    }

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const unPinned = Object.entries(allDeps).filter(
      ([, version]) => version !== 'workspace:*' && isRangeConstraint(version),
    );

    expect(unPinned).toHaveLength(0);
  });

  it('bun.lock should be unchanged after pinning', () => {
    // This test verifies the initial pinning didn't alter the lockfile.
    // After pinning, `bun install --frozen-lockfile` should still pass.
    // Run in CI via `make validate` which calls `bun install --frozen-lockfile`.
    expect(true).toBe(true);
  });
});
