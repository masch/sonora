import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dir, '..', 'check-deps.ts');

interface Fixture {
  catalog: Record<string, string>;
  workspaces: Record<string, Record<string, string>>;
}

let root: string;

function build(fixture: Fixture): void {
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify(
      { name: 'fixture', private: true, workspaces: ['apps/*'], catalog: fixture.catalog },
      null,
      2,
    )}\n`,
  );
  for (const [dir, deps] of Object.entries(fixture.workspaces)) {
    mkdirSync(join(root, 'apps', dir), { recursive: true });
    writeFileSync(
      join(root, 'apps', dir, 'package.json'),
      `${JSON.stringify({ name: `@fixture/${dir}`, version: '1.0.0', dependencies: deps }, null, 2)}\n`,
    );
  }
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
