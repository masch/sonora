/**
 * Downloads that cannot lie: a resumed transfer, a speed guard, and an integrity check that
 * has to pass before the file is used. Every test here drives the real code with a scripted
 * HTTP response, so no test needs the network.
 */
import { describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type FetchLike,
  downloadVerified,
  gzipProblem,
  guardProgress,
  jarProblem,
  osmPbfProblem,
  sourcesProblems,
  zipProblem,
} from '../download';
import { osmPbfHeader, storedZip } from './archives';

/** A scratch directory the caller removes; each test owns its own. */
function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'map-tiles-download-'));
}

interface FakeResponse {
  status: number;
  /** Read case-insensitively, the way `Headers` would answer the downloader. */
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array>;
}

/**
 * A response body that ends, fails, or stalls after its chunks — the last one is the mirror
 * that hangs for hours without closing the connection.
 */
function body(
  chunks: Buffer[],
  mode: 'close' | 'error' | 'stall' = 'close',
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      if (mode === 'close') controller.close();
      if (mode === 'error') controller.error(new Error('connection reset by peer'));
      if (mode === 'stall') {
        signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
      }
    },
  });
}

function serve(
  status: number,
  headers: Record<string, string>,
  chunks: Buffer[],
  mode: 'close' | 'error' | 'stall' = 'close',
  signal?: AbortSignal,
): FakeResponse {
  const lower = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return {
    status,
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
    body: body(chunks, mode, signal),
  };
}

/**
 * A fetch that answers from a script, one response per request, and records the requests so a
 * test can state what the second attempt asked for.
 */
function scriptedFetch(responses: Array<(signal?: AbortSignal) => FakeResponse>): {
  fetchLike: FetchLike;
  requests: Array<{ url: string; headers: Record<string, string> }>;
} {
  const requests: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchLike: FetchLike = async (url, init) => {
    requests.push({ url, headers: init.headers });
    const index = Math.min(requests.length - 1, responses.length - 1);
    return responses[index](init.signal);
  };
  return { fetchLike, requests };
}

describe('downloadVerified', () => {
  it('resumes from the bytes already on disk instead of starting over', async () => {
    const root = scratch();
    try {
      const destination = join(root, 'argentina.osm.pbf');
      writeFileSync(`${destination}.part`, 'abcd');
      const { fetchLike, requests } = scriptedFetch([
        () =>
          serve(206, { 'content-range': 'bytes 4-9/10', 'content-length': '6' }, [
            Buffer.from('efghij'),
          ]),
      ]);

      const result = await downloadVerified(
        { url: 'https://example.invalid/extract.osm.pbf', destination },
        { fetch: fetchLike, log: () => {} },
      );

      expect(result.ok).toBe(true);
      expect(result.resumedFrom).toBe(4);
      expect(result.bytes).toBe(10);
      expect(requests[0]?.headers['Range']).toBe('bytes=4-');
      expect(existsSync(`${destination}.part`)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('restarts from zero when the server ignores the range it was asked for', async () => {
    const root = scratch();
    try {
      const destination = join(root, 'extract.osm.pbf');
      writeFileSync(`${destination}.part`, 'abcd');
      const { fetchLike } = scriptedFetch([
        () => serve(200, { 'content-length': '10' }, [Buffer.from('0123456789')]),
      ]);

      const result = await downloadVerified(
        { url: 'https://example.invalid/extract.osm.pbf', destination },
        { fetch: fetchLike, log: () => {} },
      );

      expect(result.ok).toBe(true);
      expect(result.resumedFrom).toBe(0);
      expect(result.bytes).toBe(10);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stops an attempt whose transfer stalls without closing, then resumes it', async () => {
    const root = scratch();
    try {
      const destination = join(root, 'extract.osm.pbf');
      const { fetchLike, requests } = scriptedFetch([
        (signal) => serve(200, { 'content-length': '10' }, [Buffer.from('012')], 'stall', signal),
        () => serve(206, { 'content-range': 'bytes 3-9/10' }, [Buffer.from('3456789')]),
      ]);

      const result = await downloadVerified(
        { url: 'https://example.invalid/extract.osm.pbf', destination, windowMs: 25 },
        { fetch: fetchLike, log: () => {} },
      );

      expect(result.ok).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.bytes).toBe(10);
      expect(requests).toHaveLength(2);
      expect(requests[0]?.headers['Range']).toBeUndefined();
      expect(requests[1]?.headers['Range']).toBe('bytes=3-');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('gives up naming the shortfall when the server sends fewer bytes than it promised', async () => {
    const root = scratch();
    try {
      const destination = join(root, 'extract.osm.pbf');
      const { fetchLike } = scriptedFetch([
        () => serve(200, { 'content-length': '10' }, [Buffer.from('01234')]),
      ]);

      const result = await downloadVerified(
        { url: 'https://example.invalid/extract.osm.pbf', destination, attempts: 1 },
        { fetch: fetchLike, log: () => {} },
      );

      expect(result.ok).toBe(false);
      expect(result.message).toContain('5 of 10 bytes');
      expect(existsSync(destination)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('never puts a finished download in place when its integrity check fails', async () => {
    const root = scratch();
    try {
      const destination = join(root, 'water-polygons-split-3857.zip');
      const notFound = Buffer.from('<html>Not Found</html>');
      const { fetchLike } = scriptedFetch([
        () => serve(200, { 'content-length': String(notFound.length) }, [notFound]),
      ]);

      const result = await downloadVerified(
        {
          url: 'https://example.invalid/water-polygons-split-3857.zip',
          destination,
          attempts: 1,
          verify: zipProblem,
        },
        { fetch: fetchLike, log: () => {} },
      );

      expect(result.ok).toBe(false);
      expect(result.message).toContain('zip');
      expect(existsSync(destination)).toBe(false);
      expect(existsSync(`${destination}.part`)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('touches the network only when the file on disk does not verify', async () => {
    const root = scratch();
    try {
      const destination = join(root, 'natural_earth_vector.gpkg.zip');
      writeFileSync(destination, storedZip('ne.gpkg'));
      const cached = scriptedFetch([]);

      const first = await downloadVerified(
        { url: 'https://example.invalid/ne.zip', destination, verify: zipProblem },
        { fetch: cached.fetchLike, log: () => {} },
      );

      expect(first.ok).toBe(true);
      expect(first.cached).toBe(true);
      expect(cached.requests).toHaveLength(0);

      // A file that no longer verifies is discarded and fetched again: the archive is a
      // cache entry, never evidence.
      writeFileSync(destination, 'Not Found');
      const fresh = storedZip('ne.gpkg');
      const refetch = scriptedFetch([
        () => serve(200, { 'content-length': String(fresh.length) }, [fresh]),
      ]);
      const second = await downloadVerified(
        { url: 'https://example.invalid/ne.zip', destination, verify: zipProblem },
        { fetch: refetch.fetchLike, log: () => {} },
      );

      expect(second.ok).toBe(true);
      expect(second.cached).toBe(false);
      expect(refetch.requests).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('zipProblem', () => {
  it('accepts a complete archive and names a truncated one', () => {
    const root = scratch();
    try {
      const intact = join(root, 'intact.zip');
      writeFileSync(intact, storedZip('a.txt'));
      expect(zipProblem(intact)).toBeNull();

      const truncated = join(root, 'truncated.zip');
      const bytes = storedZip('a.txt');
      writeFileSync(truncated, bytes.subarray(0, bytes.length - 12));
      expect(zipProblem(truncated)).toContain('central directory');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a file that is not a zip at all', () => {
    const root = scratch();
    try {
      const html = join(root, 'error.html');
      writeFileSync(html, '<html>Not Found</html>');
      expect(zipProblem(html)).toContain('zip');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('jarProblem', () => {
  it('wants a manifest, so a nine-byte "Not Found" is never run as a jar', () => {
    const root = scratch();
    try {
      const withoutManifest = join(root, 'profile-with-deps.jar');
      writeFileSync(withoutManifest, storedZip('Basemap.class'));
      expect(jarProblem(withoutManifest)).toContain('META-INF/MANIFEST.MF');

      const jar = join(root, 'good-with-deps.jar');
      writeFileSync(jar, storedZip('META-INF/MANIFEST.MF', 'Main-Class: x'));
      expect(jarProblem(jar)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('osmPbfProblem', () => {
  it('accepts a file that starts with an OSM header blob', () => {
    const root = scratch();
    try {
      const extract = join(root, 'argentina.osm.pbf');
      writeFileSync(extract, osmPbfHeader());
      expect(osmPbfProblem(extract)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an error page and an empty file', () => {
    const root = scratch();
    try {
      const html = join(root, 'html.osm.pbf');
      writeFileSync(html, '<html>Not Found</html>');
      expect(osmPbfProblem(html)).toContain('OSM PBF');

      const empty = join(root, 'empty.osm.pbf');
      writeFileSync(empty, '');
      expect(osmPbfProblem(empty)).toContain('OSM PBF');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('gzipProblem', () => {
  it('recognises a gzip stream by its magic bytes', () => {
    const root = scratch();
    try {
      const gz = join(root, 'qrank.csv.gz');
      writeFileSync(gz, Buffer.from([0x1f, 0x8b, 0x08, 0x00]));
      expect(gzipProblem(gz)).toBeNull();

      writeFileSync(gz, 'Not Found');
      expect(gzipProblem(gz)).toContain('gzip');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('sourcesProblems', () => {
  it('passes a sources directory whose every artefact opens', () => {
    const root = scratch();
    try {
      const sources = join(root, 'data', 'sources');
      mkdirSync(sources, { recursive: true });
      writeFileSync(join(sources, 'water-polygons-split-3857.zip'), storedZip('water.shp'));
      writeFileSync(join(sources, 'argentina.osm.pbf'), osmPbfHeader());
      writeFileSync(join(sources, 'qrank.csv.gz'), Buffer.from([0x1f, 0x8b, 0x08]));

      expect(sourcesProblems(sources)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('names every artefact that cannot be used, and an empty directory', () => {
    const root = scratch();
    try {
      const sources = join(root, 'data', 'sources');
      mkdirSync(sources, { recursive: true });
      expect(sourcesProblems(sources)).toHaveLength(1);

      const bytes = storedZip('water.shp');
      writeFileSync(
        join(sources, 'water-polygons-split-3857.zip'),
        bytes.subarray(0, bytes.length - 12),
      );
      writeFileSync(join(sources, 'argentina.osm.pbf'), 'Not Found');

      const problems = sourcesProblems(sources);
      expect(problems).toHaveLength(2);
      expect(problems.join('\n')).toContain('water-polygons-split-3857.zip');
      expect(problems.join('\n')).toContain('argentina.osm.pbf');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('guardProgress', () => {
  /** A clock that only moves when the guard sleeps, so the guard's timing is deterministic. */
  function clock(): { now: () => number; sleep: (ms: number) => Promise<void> } {
    let time = 0;
    return {
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
    };
  }

  it('stops a command whose output stopped growing', async () => {
    const time = clock();
    let stalls = 0;

    const outcome = await guardProgress(
      {
        measure: () => 100,
        isDone: () => false,
        stallMs: 300,
        intervalMs: 100,
        onStall: () => {
          stalls += 1;
        },
      },
      { now: time.now, sleep: time.sleep },
    );

    expect(outcome).toBe('stalled');
    expect(stalls).toBe(1);
  });

  it('lets a command that keeps producing bytes finish on its own', async () => {
    const time = clock();
    const sizes = [100, 200, 400, 800];
    let reads = 0;
    let stalls = 0;

    const outcome = await guardProgress(
      {
        measure: () => sizes[Math.min(reads, sizes.length - 1)] ?? 0,
        isDone: () => {
          reads += 1;
          return reads > 3;
        },
        stallMs: 300,
        intervalMs: 100,
        onStall: () => {
          stalls += 1;
        },
      },
      { now: time.now, sleep: time.sleep },
    );

    expect(outcome).toBe('done');
    expect(stalls).toBe(0);
  });
});
