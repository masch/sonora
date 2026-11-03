/**
 * What staging actually serves, pinned.
 *
 * Publishing is not proof: the bucket can hold the new archive while `/config` still points every
 * client at the old key, and a client that already holds an archive of exactly this size treats it
 * as current (`isArchiveCurrent` compares bytes, not content). Both are failures that look like
 * success from the terminal where the upload succeeded, so they are what this check answers.
 */
import { describe, expect, it } from 'bun:test';

import {
  assertFree,
  catalogEntry,
  firstFreeVersion,
  runVerify,
  tileVersionOf,
  type VerifyDeps,
  type VerifyInput,
} from '../verify-published';

const API = 'https://sonora-api-staging.sonora-api.workers.dev';

/** The payload `/config` answers, trimmed to the part this check reads. */
function catalog(version: string, bytes: number, region = 'calamuchita') {
  return {
    map: {
      regions: {
        [region]: {
          bbox: [-64.83, -32.28, -64.66, -32.12],
          label: 'Valle de Calamuchita',
          archiveUrl: `${API}/media/public/tiles/${region}/${version}.pmtiles`,
          archiveBytes: bytes,
        },
      },
    },
  };
}

const BUILT = new TextEncoder().encode('the archive we just built');

function deps(
  overrides: Partial<VerifyDeps> & { config?: unknown; served?: Uint8Array } = {},
): VerifyDeps {
  return {
    fetchJson: async () => overrides.config ?? catalog('v1', BUILT.byteLength),
    fetchBytes: async () => overrides.served ?? BUILT,
    readArchive: async () => BUILT,
    log: () => {},
    ...(overrides.fetchJson === undefined ? {} : { fetchJson: overrides.fetchJson }),
    ...(overrides.fetchBytes === undefined ? {} : { fetchBytes: overrides.fetchBytes }),
    ...(overrides.readArchive === undefined ? {} : { readArchive: overrides.readArchive }),
  };
}

const INPUT: VerifyInput = {
  region: 'calamuchita',
  version: 'v1',
  archivePath: '/var/tmp/out/calamuchita.pmtiles',
  previousBytes: null,
  apiBase: API,
};

describe('catalogEntry', () => {
  it('reads the archive the catalog points clients at, and the size it advertises', () => {
    expect(catalogEntry(catalog('v1', 881143), 'calamuchita')).toEqual({
      archiveUrl: `${API}/media/public/tiles/calamuchita/v1.pmtiles`,
      archiveBytes: 881143,
      version: 'v1',
    });
  });

  it('answers null for a region the catalog does not publish', () => {
    expect(catalogEntry(catalog('v1', 1), 'patagonia')).toBeNull();
    expect(catalogEntry({}, 'calamuchita')).toBeNull();
    expect(catalogEntry(null, 'calamuchita')).toBeNull();
  });

  it('names no version for a url that is not one of our archives', () => {
    expect(tileVersionOf(`${API}/media/public/tiles/calamuchita/v1.pmtiles`)).toBe('v1');
    expect(tileVersionOf(`${API}/media/public/tiles/calamuchita/v1.pmtiles?x=1`)).toBe('v1');
    expect(tileVersionOf(`${API}/media/public/styles/v1.json`)).toBeNull();
    expect(tileVersionOf('not a url')).toBeNull();
  });
});

describe('assertFree', () => {
  /** A deps double whose two media urls answer with `archive` and `style` statuses. */
  function statusDeps(archive: number, style: number): VerifyDeps {
    return {
      ...deps(),
      fetchStatus: async (url) => (url.endsWith('.json') ? style : archive),
    };
  }

  it('passes when neither the archive nor the style of that version exists', async () => {
    const result = await assertFree(
      { region: 'calamuchita', version: 'v2', apiBase: API },
      statusDeps(404, 404),
    );
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails when the version was already published, naming the key that took it', async () => {
    const result = await assertFree(
      { region: 'calamuchita', version: 'v1', apiBase: API },
      statusDeps(200, 404),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('tiles/calamuchita/v1.pmtiles');
    expect(result.failures.join(' ')).toContain('MAP_ARTIFACT_VERSION');
  });

  it('fails when only the style of that version is taken, so a retry would mix two publishes', async () => {
    const result = await assertFree(
      { region: 'calamuchita', version: 'v1', apiBase: API },
      statusDeps(404, 200),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('styles/v1.json');
  });

  it('fails when the check itself could not be answered, instead of assuming the key is free', async () => {
    const result = await assertFree(
      { region: 'calamuchita', version: 'v2', apiBase: API },
      { ...deps(), fetchStatus: async () => 500 },
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('500');
  });
});

describe('firstFreeVersion', () => {
  /** Answers the archive and style keys of `taken` with 200 and every other with 404. */
  function statusDeps(taken: string[], unexpected?: number): VerifyDeps {
    return {
      ...deps(),
      fetchStatus: async (url) => {
        if (unexpected !== undefined) return unexpected;
        return taken.some((version) => url.includes(`/${version}.`)) ? 200 : 404;
      },
    };
  }

  it('answers v1 when nothing is published', async () => {
    const found = await firstFreeVersion({ region: 'calamuchita', apiBase: API }, statusDeps([]));
    expect(found.ok).toBe(true);
    expect(found.version).toBe('v1');
  });

  it('skips every version that is taken, in order', async () => {
    const found = await firstFreeVersion(
      { region: 'calamuchita', apiBase: API },
      statusDeps(['v1', 'v2']),
    );
    expect(found.version).toBe('v3');
  });

  it('does not call a half-published version free', async () => {
    // The style landed and the archive did not: the next publish has to move on.
    const found = await firstFreeVersion(
      { region: 'calamuchita', apiBase: API },
      { ...deps(), fetchStatus: async (url) => (url.endsWith('v1.json') ? 200 : 404) },
    );
    expect(found.version).toBe('v2');
  });

  it('stops at the limit instead of searching forever', async () => {
    const found = await firstFreeVersion(
      { region: 'calamuchita', apiBase: API, limit: 3 },
      { ...deps(), fetchStatus: async () => 200 },
    );
    expect(found.ok).toBe(false);
    expect(found.failures.join(' ')).toContain('v1..v3');
  });

  it('refuses to guess when the bucket cannot be asked', async () => {
    const found = await firstFreeVersion(
      { region: 'calamuchita', apiBase: API },
      statusDeps([], 503),
    );
    expect(found.ok).toBe(false);
    expect(found.failures.join(' ')).toContain('503');
  });
});

describe('runVerify', () => {
  it('passes when staging serves the bytes that were built, from the version just uploaded', async () => {
    const result = await runVerify(INPUT, deps());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toContain(`built ${BUILT.byteLength} bytes`);
    expect(result.lines.join('\n')).toContain(`served ${BUILT.byteLength} bytes`);
  });

  it('notes the pending version bump when /config still names another version', async () => {
    // Publishing happens before the config moves: the objects are immutable and nobody reads
    // them until `/config` names that version, so a publish that has not reached clients yet
    // is a step of the procedure and not a failure.
    const result = await runVerify(
      { ...INPUT, version: 'v2' },
      deps({ config: catalog('v1', BUILT.byteLength) }),
    );
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toContain('pending');
    expect(result.lines.join('\n')).toContain('v1');
    expect(result.lines.join('\n')).toContain('v2');
    expect(result.lines.join('\n')).toContain('MAP_ARTIFACT_VERSION');
  });

  it('checks the bytes of the version it published, not the one /config still names', async () => {
    // Publishing happens before the config moves, so `/config` points at the previous version:
    // comparing this run's archive against that url is how a good publish reads as a mismatch.
    const previous = new TextEncoder().encode('the archive that is live until the deploy');
    const seen: string[] = [];
    const result = await runVerify(
      { ...INPUT, version: 'v2' },
      {
        ...deps({ config: catalog('v1', previous.byteLength) }),
        fetchBytes: async (url) => {
          seen.push(url);
          return url.endsWith('v2.pmtiles') ? BUILT : previous;
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(seen).toEqual([`${API}/media/public/tiles/calamuchita/v2.pmtiles`]);
    // And the size in the payload describes the version still in play, so it is not compared.
    expect(result.failures).toEqual([]);
  });

  it('fails on that mismatch when the check is asked to prove the version is live', async () => {
    // `--require-live` is the post-deploy check: after the config PR merged and the Worker
    // deployed, a `/config` naming another version means clients are not on this artifact.
    const result = await runVerify(
      { ...INPUT, version: 'v2', requireLive: true },
      deps({ config: catalog('v1', BUILT.byteLength) }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('v2');
    expect(result.failures.join(' ')).toContain('MAP_ARTIFACT_VERSION');
  });

  it('notes a pending region the catalog does not carry yet, which is the first publish', async () => {
    // Production today publishes `regions: {}`: the very first publish there must not fail, the
    // config PR that names the version is what puts the region in the catalog.
    const result = await runVerify(INPUT, deps({ config: {} }));
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toContain('pending');
    expect(result.lines.join('\n')).toContain('calamuchita');
  });

  it('fails on a missing region when the check is asked to prove the version is live', async () => {
    const result = await runVerify({ ...INPUT, requireLive: true }, deps({ config: {} }));
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('calamuchita');
  });

  it('fails when /config advertises another size than the one built', async () => {
    // A device compares this number, so a stale one keeps the archive it already has.
    const stale = await runVerify(INPUT, deps({ config: catalog('v1', BUILT.byteLength - 1) }));
    expect(stale.ok).toBe(false);
    expect(stale.failures.join(' ')).toContain(String(BUILT.byteLength - 1));
    expect(stale.failures.join(' ')).toContain(String(BUILT.byteLength));

    // A region priced at zero is the same failure: there is nothing to compare.
    const unpriced = await runVerify(INPUT, deps({ config: catalog('v1', 0) }));
    expect(unpriced.ok).toBe(false);
  });

  it('fails when /config publishes the region without a byte count', async () => {
    const config = {
      map: {
        regions: {
          calamuchita: {
            bbox: [-64.83, -32.28, -64.66, -32.12],
            label: 'Valle de Calamuchita',
            archiveUrl: `${API}/media/public/tiles/calamuchita/v1.pmtiles`,
          },
        },
      },
    };

    const result = await runVerify(INPUT, deps({ config }));
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('without a byte count');
  });

  it('fails when what staging serves is not what was built', async () => {
    const served = new TextEncoder().encode('an older archive of another length');
    const result = await runVerify(INPUT, deps({ served }));
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('sha256');
  });

  it('warns when the archive has exactly the size devices already hold, because they keep it', async () => {
    const result = await runVerify({ ...INPUT, previousBytes: BUILT.byteLength }, deps());
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toContain('same size');
    expect(result.lines.join('\n')).toContain('VERSION');
  });

  it('says nothing about stale devices when the archive changed size', async () => {
    const result = await runVerify({ ...INPUT, previousBytes: BUILT.byteLength + 1 }, deps());
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).not.toContain('same size');
  });
});
