/**
 * The upload policy, pinned: staging revalidates, production does not.
 *
 * A mutable key served `immutable` is cached for a year and never asked about again. That is
 * exactly what happened on staging: `styles/v1.json` was cached while the target still wrote
 * `immutable`, and every reload afterwards answered from disk — the map kept an ancient style
 * while the archive refreshed, and no amount of republishing could reach the browser.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const MAKEFILE = readFileSync(join(REPO, 'Makefile'), 'utf8');

/** The `r2 object put` lines that upload a map artifact to one bucket. */
function uploadLines(bucket: string): string[] {
  return MAKEFILE.split('\n').filter(
    (line) =>
      line.includes(`bunx wrangler r2 object put ${bucket}/`) &&
      (line.includes('/tiles/') || line.includes('/styles/')),
  );
}

describe('map artifact uploads', () => {
  it('let staging revalidate, because its keys are overwritten in place', () => {
    const lines = uploadLines('sonora-staging-public-audio');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain('must-revalidate');
      expect(line).not.toContain('immutable');
    }
  });

  it('keep production immutable, because a new version is a new key', () => {
    const lines = uploadLines('sonora-production-public-audio');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain('immutable');
    }
  });
});
