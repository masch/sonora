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
  catalogEntry,
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

describe('runVerify', () => {
  it('passes when staging serves the bytes that were built, from the version just uploaded', async () => {
    const result = await runVerify(INPUT, deps());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toContain(`built ${BUILT.byteLength} bytes`);
    expect(result.lines.join('\n')).toContain(`served ${BUILT.byteLength} bytes`);
  });

  it('fails when /config still points clients at another version', async () => {
    const result = await runVerify(
      { ...INPUT, version: 'v2' },
      deps({ config: catalog('v1', BUILT.byteLength) }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('v1');
    expect(result.failures.join(' ')).toContain('v2');
    expect(result.failures.join(' ')).toContain('MAP_ARTIFACT_VERSION');
  });

  it('fails when the region is not in the catalog at all, so no client can reach it', async () => {
    const result = await runVerify(INPUT, deps({ config: {} }));
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('calamuchita');
    expect(result.failures.join(' ')).toContain('not published');
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
