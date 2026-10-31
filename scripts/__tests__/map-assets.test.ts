/**
 * The asset check, asserted on the one document it must refuse.
 *
 * `verify` exists to prove the bucket serves what the style names, and its blind spot was a style
 * that names **nothing**: the log said "nothing to verify", the exit status was 0, and the CI step
 * went green on the one document it should have blocked — a served style that lost `glyphs` and
 * `sprite`, which is exactly what a rewrite regression looks like from a client's side.
 *
 * `fetch` keeps the opposite answer on purpose: a style with no assets really does have nothing to
 * download, and refusing there would break a legitimate case.
 */
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

/** Runs the CLI the way the Makefile and CI do, and reports what it said. */
function run(command: 'verify' | 'fetch', style: string) {
  const result = Bun.spawnSync(['bun', 'scripts/map-assets.ts', command, `--style=${style}`], {
    cwd: REPO,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

/** A style document that names no glyphs and no sprite at all. */
function styleNamingNothing(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sonora-assets-'));
  const path = join(dir, 'style.json');
  writeFileSync(
    path,
    JSON.stringify({ version: 8, layers: [{ id: 'background', type: 'background' }] }),
  );
  return path;
}

describe('verifying a style that names no assets', () => {
  it('fails instead of reporting that there is nothing to verify', () => {
    const style = styleNamingNothing();
    try {
      const result = run('verify', style);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('refusing to verify an empty asset set');
    } finally {
      rmSync(join(style, '..'), { recursive: true, force: true });
    }
  });

  it('still lets fetch answer that there is nothing to download', () => {
    const style = styleNamingNothing();
    try {
      const result = run('fetch', style);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('nothing to fetch');
    } finally {
      rmSync(join(style, '..'), { recursive: true, force: true });
    }
  });
});
