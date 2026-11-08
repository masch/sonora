import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dir, '..', 'sync-deps.ts');

interface Fixture {
  shared?: Record<string, string>;
  lockstep?: Record<string, string[]>;
  allowDrift?: string[];
  workspaces: Record<string, Record<string, string>>;
}

let root: string;

function build(fixture: Fixture): void {
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', private: true, workspaces: ['apps/*'] }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, 'deps.shared.json'),
    `${JSON.stringify(
      {
        shared: fixture.shared ?? {},
        lockstep: fixture.lockstep ?? {},
        allowDrift: fixture.allowDrift ?? [],
      },
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

function readWorkspace(dir: string): { dependencies: Record<string, string> } {
  return JSON.parse(readFileSync(join(root, 'apps', dir, 'package.json'), 'utf8'));
}

function snapshot(): string {
  return ['a', 'b']
    .map((dir) => readFileSync(join(root, 'apps', dir, 'package.json'), 'utf8'))
    .join('\n');
}

function runCli(...args: string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
  });
  return { code: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sync-deps-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('sync-deps', () => {
  it('exits 0 and writes nothing when every workspace matches', () => {
    build({
      shared: { react: '19.2.3' },
      workspaces: { a: { react: '19.2.3' }, b: { react: '19.2.3' } },
    });
    const before = snapshot();

    const { code, stdout } = runCli();

    expect(code).toBe(0);
    expect(stdout).toContain('matches deps.shared.json');
    expect(snapshot()).toBe(before);
  });

  it('reports a drifted version with the workspace, package, declared and expected values', () => {
    build({
      shared: { react: '19.2.3' },
      workspaces: { a: { react: '19.2.3' }, b: { react: '19.1.0' } },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('apps/b/package.json');
    expect(stderr).toContain('react');
    expect(stderr).toContain('19.1.0');
    expect(stderr).toContain('19.2.3');
    expect(stderr).toContain('shared-version');
  });

  it('reports drift between workspaces even when the package is absent from shared', () => {
    build({
      workspaces: { a: { typescript: '6.0.3' }, b: { typescript: '6.0.4' } },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('cross-workspace-drift');
    expect(stderr).toContain('typescript');
  });

  it('stays quiet about a package listed in allowDrift', () => {
    build({
      allowDrift: ['typescript'],
      workspaces: { a: { typescript: '6.0.3' }, b: { typescript: '6.0.4' } },
    });

    const { code } = runCli();

    expect(code).toBe(0);
  });

  it('refuses a lockstep group that shared can only move partially, and writes nothing on apply', () => {
    build({
      shared: { react: '19.2.3' },
      lockstep: { react: ['react', 'react-dom'] },
      workspaces: {
        a: { react: '19.2.3', 'react-dom': '19.0.0' },
        b: { react: '19.2.3', 'react-dom': '19.0.0' },
      },
    });
    const before = snapshot();

    const dryRun = runCli();
    const applied = runCli('--apply');

    expect(dryRun.code).toBe(1);
    expect(dryRun.stderr).toContain('lockstep');
    expect(applied.code).toBe(1);
    expect(snapshot()).toBe(before);
  });

  it('applies shared versions only inside the tree it was given', () => {
    build({
      shared: { react: '19.2.3' },
      workspaces: { a: { react: '19.2.3' }, b: { react: '19.1.0' } },
    });

    const { code, stdout } = runCli('--apply');

    expect(code).toBe(0);
    expect(stdout).toContain('19.1.0 -> 19.2.3');
    expect(readWorkspace('a').dependencies.react).toBe('19.2.3');
    expect(readWorkspace('b').dependencies.react).toBe('19.2.3');
  });

  it('rejects a shared entry that no workspace declares', () => {
    build({
      shared: { react: '19.2.3', nonexistent: '1.0.0' },
      workspaces: { a: { react: '19.2.3' }, b: { react: '19.2.3' } },
    });

    const { code, stderr } = runCli();

    expect(code).toBe(1);
    expect(stderr).toContain('stale-entry');
    expect(stderr).toContain('nonexistent');
  });
});
