/**
 * Pre-seeding the tiler's own sources: the table, the cache hit, and the file that looks
 * complete and is not.
 *
 * Every test drives the real downloader with a scripted HTTP response and its own scratch
 * directory, so none of them needs the network — and none of them can collide with a build that
 * is already reading `<cache>/planetiler/data/sources`.
 */
import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_MAP_REGION } from '../../../packages/shared/src/map/regions';
import { planBuild } from '../build';
import type { FetchLike } from '../download';
import { fetchSources, sourceOptions, sourcesForRegion } from '../fetch-sources';
import { storedZip } from './archives';

/** A scratch directory the caller removes; each test owns its own. */
function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'map-tiles-fetch-sources-'));
}

interface FakeResponse {
  status: number;
  /** Read case-insensitively, the way `Headers` would answer the downloader. */
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array>;
}

function serve(status: number, headers: Record<string, string>, chunks: Buffer[]): FakeResponse {
  const lower = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return {
    status,
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
        controller.close();
      },
    }),
  };
}

/**
 * A fetch that answers from a script and records every request, so a test can say both what was
 * asked for and — when the answer is "nothing" — that nothing was asked at all.
 */
function scriptedFetch(respond: () => FakeResponse): {
  fetchLike: FetchLike;
  urls: string[];
} {
  const urls: string[] = [];
  const fetchLike: FetchLike = async (url) => {
    urls.push(url);
    return respond();
  };
  return { fetchLike, urls };
}

/** The destination one source gets under a cache root, and the name it is fetched by. */
function destinationOf(cacheDir: string, name: string): string {
  const source = sourcesForRegion(DEFAULT_MAP_REGION).find((each) => each.name === name);
  if (source === undefined) throw new Error(`the table has no source named ${name}`);
  return sourceOptions(source, cacheDir).destination;
}

describe('the source table', () => {
  // Six files, not five: the extract is one of them, and the three planetiler fetches itself
  // (qrank, the landcover GeoPackage, Natural Earth) are exactly the ones that kept restarting
  // from zero and costing whole runs.
  it('names every source the tiler needs for the default region', () => {
    expect(sourcesForRegion(DEFAULT_MAP_REGION).map((source) => source.name)).toEqual([
      'argentina.osm.pbf',
      'water-polygons-split-3857.zip',
      'land-polygons-split-3857.zip',
      'qrank.csv.gz',
      'daylight-landcover.gpkg',
      'natural_earth_vector.gpkg.zip',
    ]);
  });

  it('gives every source a url, a destination name and a verifier', () => {
    for (const source of sourcesForRegion(DEFAULT_MAP_REGION)) {
      expect(source.url.startsWith('https://')).toBe(true);
      // The name is the file name: a path separator would put the file somewhere planetiler
      // never looks, and it would download its own copy over ours.
      expect(source.name).not.toContain('/');
      expect(typeof source.verify).toBe('function');
    }
  });

  it('takes the extract from the region table, the way the build does', () => {
    const extract = sourcesForRegion(DEFAULT_MAP_REGION)[0];
    expect(extract?.url).toBe(
      'https://download.geofabrik.de/south-america/argentina-latest.osm.pbf',
    );
    // Same file name the build's `osm-path` uses, so planetiler finds the extract we verified.
    expect(extract?.name).toBe('argentina.osm.pbf');
  });

  it('puts every destination where planetiler resolves its sources', () => {
    // `<cache>/planetiler/data/sources` is the tiler's working directory plus its own relative
    // path. A file one level off is a file it downloads again.
    expect(destinationOf(join('/nowhere', 'sonora-cache'), 'qrank.csv.gz')).toBe(
      join('/nowhere', 'sonora-cache', 'planetiler', 'data', 'sources', 'qrank.csv.gz'),
    );
  });
});

describe('the region', () => {
  // `MAP_TILE_EXTRACTS` in build.ts is the one place that says what a region means. A second
  // opinion here would let `--region=atlantis` fetch an extract of somewhere else, which is the
  // failure that table exists to stop — so the sentence is the build's own, verbatim.
  it('refuses an unknown region in exactly the build’s words', () => {
    let buildMessage = '';
    try {
      planBuild({
        region: 'atlantis',
        maxzoom: 16,
        cacheDir: '/nowhere/cache',
        workDir: '/nowhere/cache/basemaps',
        repoRoot: '/nowhere',
      });
    } catch (error) {
      buildMessage = error instanceof Error ? error.message : String(error);
    }
    expect(buildMessage).toContain('unknown region "atlantis"');

    let fetchMessage = '';
    try {
      sourcesForRegion('atlantis');
    } catch (error) {
      fetchMessage = error instanceof Error ? error.message : String(error);
    }
    expect(fetchMessage).toBe(buildMessage);
  });
});

describe('fetchSources', () => {
  // 932 MB of water polygons is not something to re-download to learn that it is already there,
  // and a cache hit has to be a hit before the first byte is asked for.
  it('reports a destination that already verifies as cached and fetches nothing', async () => {
    const root = scratch();
    try {
      const destination = destinationOf(root, 'land-polygons-split-3857.zip');
      const archive = storedZip('land-polygons.shp');
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, archive);
      const { fetchLike, urls } = scriptedFetch(() => {
        throw new Error('nothing should have been requested');
      });

      const lines: string[] = [];
      const result = await fetchSources(
        { region: DEFAULT_MAP_REGION, cacheDir: root, only: ['land-polygons-split-3857.zip'] },
        { fetch: fetchLike, log: (line) => lines.push(line) },
      );

      expect(result.ok).toBe(true);
      expect(urls).toEqual([]);
      expect(lines).toContain(
        `land-polygons-split-3857.zip: cached (${archive.length} bytes already on disk and verified)`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Tonight's worst case: a mirror padded the file to the content-length it promised, so the
  // size check passed and the bytes were zeros. The file cannot be trusted, and trusting it is
  // worse than downloading again — a build reads it and produces nothing.
  it('re-fetches a file that is the promised size and fails its verifier', async () => {
    const root = scratch();
    try {
      const destination = destinationOf(root, 'qrank.csv.gz');
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, Buffer.alloc(64));
      const gzip = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03]);
      const { fetchLike, urls } = scriptedFetch(() =>
        serve(200, { 'content-length': String(gzip.length) }, [gzip]),
      );

      const lines: string[] = [];
      const result = await fetchSources(
        { region: DEFAULT_MAP_REGION, cacheDir: root, only: ['qrank.csv.gz'] },
        { fetch: fetchLike, log: (line) => lines.push(line) },
      );

      expect(result.ok).toBe(true);
      expect(urls).toEqual(['https://qrank.toolforge.org/download/qrank.csv.gz']);
      expect(readFileSync(destination).equals(gzip)).toBe(true);
      // The bytes plus how many were reused: the zeros were thrown away, so nothing was reused.
      expect(lines).toContain('qrank.csv.gz: 10 bytes (0 reused from disk)');
      // And the reason it was thrown away is said out loud, not swallowed.
      expect(lines.some((line) => line.includes('discarding') && line.includes('gzip'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // One unreachable mirror must cost one source, not the five that would have been fine: the
  // run keeps going and reports what is missing at the end.
  it('keeps going after a source fails, and reports the run as failed', async () => {
    const root = scratch();
    try {
      const cached = destinationOf(root, 'water-polygons-split-3857.zip');
      mkdirSync(dirname(cached), { recursive: true });
      writeFileSync(cached, storedZip('water-polygons.shp'));
      const { fetchLike, urls } = scriptedFetch(() => serve(404, {}, [Buffer.from('Not Found')]));

      const lines: string[] = [];
      const result = await fetchSources(
        {
          region: DEFAULT_MAP_REGION,
          cacheDir: root,
          only: ['water-polygons-split-3857.zip', 'land-polygons-split-3857.zip'],
        },
        { fetch: fetchLike, log: (line) => lines.push(line) },
      );

      expect(result.ok).toBe(false);
      expect(result.outcomes.map((outcome) => [outcome.name, outcome.ok])).toEqual([
        ['water-polygons-split-3857.zip', true],
        ['land-polygons-split-3857.zip', false],
      ]);
      // Only the missing one was asked for. It was asked for three times, because a failed
      // attempt is the downloader's to retry; the cached one was never asked for at all.
      const landUrl = 'https://osmdata.openstreetmap.de/download/land-polygons-split-3857.zip';
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.every((url) => url === landUrl)).toBe(true);
      const failure = result.outcomes[1]?.line ?? '';
      expect(failure).toContain('land-polygons-split-3857.zip: FAILED');
      expect(failure).toContain('answered 404');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a name --only does not know instead of fetching the rest', async () => {
    const root = scratch();
    try {
      const { fetchLike, urls } = scriptedFetch(() => serve(200, {}, [Buffer.alloc(0)]));
      await expect(
        fetchSources(
          { region: DEFAULT_MAP_REGION, cacheDir: root, only: ['qrank.csv'] },
          { fetch: fetchLike, log: () => {} },
        ),
      ).rejects.toThrow(/unknown source "qrank.csv"/);
      expect(urls).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * The command line as `make map-tiles-fetch-sources` and a person at a terminal call it: a flag
 * nobody reads is refused rather than ignored, and a bad argument reads as one line, not as the
 * runtime's stack trace.
 */
describe('the command line', () => {
  const script = fileURLToPath(new URL('../fetch-sources.ts', import.meta.url));

  it('refuses a flag it does not read', () => {
    const run = spawnSync(process.execPath, [script, '--frobnicate=1'], { encoding: 'utf8' });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('unknown option --frobnicate');
    expect(run.stderr).not.toMatch(/^\s+at /m);
    expect(run.stderr).not.toContain('Bun v');
  });

  it('refuses an unknown region before it writes anything', () => {
    const root = scratch();
    try {
      const run = spawnSync(process.execPath, [script, '--region=atlantis', `--cache=${root}`], {
        encoding: 'utf8',
      });

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('unknown region "atlantis"');
      expect(existsSync(join(root, 'planetiler'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints its usage for --help, and names the flags and the sources', () => {
    const run = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Usage:');
    expect(run.stdout).toContain('--only');
    expect(run.stdout).toContain('daylight-landcover.gpkg');
  });
});
