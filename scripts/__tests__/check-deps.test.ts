import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dir, '..', 'check-deps.ts');

interface Fixture {
  catalog: Record<string, string>;
  /** `dependencies` block, per workspace directory. */
  workspaces: Record<string, Record<string, string>>;
  /** Extra blocks per workspace directory, e.g. `{ b: { peerDependencies: { react: '19.1.0' } } }`. */
  blocks?: Record<string, Record<string, Record<string, string>>>;
  /** Root `workspaces` patterns, in declaration order. Defaults to `['apps/*']`. */
  patterns?: string[];
}

let root: string;

function build(fixture: Fixture): void {
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        private: true,
        workspaces: fixture.patterns ?? ['apps/*'],
        catalog: fixture.catalog,
      },
      null,
      2,
    )}\n`,
  );
  const dirs = new Set([...Object.keys(fixture.workspaces), ...Object.keys(fixture.blocks ?? {})]);
  for (const dir of dirs) {
    const data: Record<string, unknown> = { name: `@fixture/${dir}`, version: '1.0.0' };
    const dependencies = fixture.workspaces[dir];
    if (dependencies) data.dependencies = dependencies;
    for (const [field, block] of Object.entries(fixture.blocks?.[dir] ?? {})) data[field] = block;
    mkdirSync(join(root, 'apps', dir), { recursive: true });
    writeFileSync(join(root, 'apps', dir, 'package.json'), `${JSON.stringify(data, null, 2)}\n`);
  }
}

/** The `cross-workspace-drift` lines of a run, order-independent. */
function driftLines(stderr: string): string[] {
  return stderr
    .split('\n')
    .filter((line) => line.startsWith('cross-workspace-drift'))
    .sort();
}

function runCli(...args: string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
  });
  return { code: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'check-deps-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('check-deps', () => {
  it('exits 0 when every cataloged package is referenced and nothing disagrees', () => {
    build({
      catalog: { react: '19.2.3', typescript: '6.0.3' },
      workspaces: {
        a: { react: 'catalog:', typescript: 'catalog:' },
        b: { react: 'catalog:' },
      },
    });

    const { code, stdout } = runCli();

    expect(code).toBe(0);
    expect(stdout).toContain('agrees with the root catalog');
  });

  it('reports a workspace that restates a cataloged version as a literal', () => {
    build({
      catalog: { react: '19.2.3' },
      workspaces: { a: { react: 'catalog:' }, b: { react: '19.1.0' } },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('catalog-literal');
    expect(stderr).toContain('apps/b/package.json');
    expect(stderr).toContain('19.1.0');
    expect(stderr).toContain('"catalog:"');
  });

  it('reports drift between workspaces for a package the catalog does not cover', () => {
    build({
      catalog: { react: '19.2.3' },
      workspaces: {
        a: { react: 'catalog:', 'react-native-screens': '4.26.0' },
        b: { react: 'catalog:', 'react-native-screens': '4.30.1' },
      },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('cross-workspace-drift');
    expect(stderr).toContain('react-native-screens');
  });

  it('reports a catalog entry no workspace declares', () => {
    build({
      catalog: { react: '19.2.3', 'left-pad': '1.3.0' },
      workspaces: { a: { react: 'catalog:' }, b: { react: 'catalog:' } },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('stale-catalog');
    expect(stderr).toContain('left-pad');
  });

  it('ignores the workspace protocol and internal packages', () => {
    build({
      catalog: { react: '19.2.3' },
      workspaces: {
        a: { react: 'catalog:', '@sonora/shared': 'workspace:*' },
        b: { react: 'catalog:', '@sonora/shared': 'workspace:*' },
      },
    });

    const { code } = runCli();

    expect(code).toBe(0);
  });

  it('keeps the majority version as expected whatever order the manifests are read in', () => {
    build({
      catalog: { react: '19.2.3' },
      workspaces: {
        a: { react: 'catalog:', 'react-native-screens': '4.30.1' },
        b: { react: 'catalog:', 'react-native-screens': '4.26.0' },
      },
      blocks: { c: { devDependencies: { 'react-native-screens': '4.26.0' } } },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('apps/a/package.json');
    expect(stderr).toContain('expected 4.26.0');
    expect(stderr).toContain('1 violation(s)');
  });

  it('fails loudly when a workspace glob base directory does not exist', () => {
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify(
        { name: 'fixture', private: true, workspaces: ['apps/*'], catalog: { react: '19.2.3' } },
        null,
        2,
      )}\n`,
    );

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('workspace pattern "apps/*" matched no package.json');
    expect(stderr).not.toContain('stale-catalog');
  });

  it('reports the same expected version when a drift tie is declared in another order', () => {
    const tie = {
      catalog: { react: '19.2.3' },
      workspaces: {
        a: { react: 'catalog:', 'react-native-screens': '4.26.0' },
        b: { react: 'catalog:', 'react-native-screens': '4.30.1' },
      },
    };

    build({ ...tie, patterns: ['apps/a', 'apps/b'] });
    const forward = runCli();
    build({ ...tie, patterns: ['apps/b', 'apps/a'] });
    const reversed = runCli();

    expect(forward.code).toBe(1);
    expect(forward.stderr).toContain('cross-workspace-drift');
    expect(driftLines(forward.stderr)).toHaveLength(1);
    expect(driftLines(reversed.stderr)).toEqual(driftLines(forward.stderr));
  });

  it('reports a catalog literal declared under peer or optional dependencies', () => {
    build({
      catalog: { react: '19.2.3' },
      workspaces: { a: { react: 'catalog:' } },
      blocks: {
        b: { peerDependencies: { react: '19.1.0' } },
        c: { optionalDependencies: { react: '19.0.0' } },
      },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('apps/b/package.json');
    expect(stderr).toContain('19.1.0');
    expect(stderr).toContain('apps/c/package.json');
    expect(stderr).toContain('19.0.0');
    expect(stderr).toContain('2 violation(s)');
  });

  it('reports drift for declarations under peer or optional dependencies', () => {
    build({
      catalog: { react: '19.2.3' },
      workspaces: { a: { react: 'catalog:', 'react-native-screens': '4.26.0' } },
      blocks: {
        b: { devDependencies: { 'react-native-screens': '4.26.0' } },
        c: { peerDependencies: { 'react-native-screens': '4.30.1' } },
        d: { optionalDependencies: { 'react-native-screens': '4.26.0' } },
      },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('apps/c/package.json');
    expect(stderr).toContain('declared 4.30.1  expected 4.26.0');
    expect(stderr).not.toContain('apps/d/package.json');
    expect(stderr).toContain('1 violation(s)');
  });

  it('fails with a clear message when the root declares no catalog', () => {
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'fixture', private: true, workspaces: ['apps/*'] }, null, 2)}\n`,
    );
    mkdirSync(join(root, 'apps', 'a'), { recursive: true });
    writeFileSync(
      join(root, 'apps', 'a', 'package.json'),
      `${JSON.stringify({ name: '@fixture/a', version: '1.0.0' }, null, 2)}\n`,
    );

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('no `catalog` block');
  });
});
