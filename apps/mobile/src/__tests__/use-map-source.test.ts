import { act, renderHook, waitFor } from '@testing-library/react-native';

// The real PMTiles reads a binary archive; the hook only needs the two calls it makes.
const mockGetHeader = jest.fn();
const mockGetZxy = jest.fn();

jest.mock('pmtiles', () => ({
  PMTiles: class {
    getHeader = mockGetHeader;
    getZxy = mockGetZxy;
  },
}));

/**
 * The storage the client cache writes to, in memory.
 *
 * The cache the style now relies on lives in `BaseApiClient` (`cacheKey`), so the base
 * client is what has to stay under test: only the platform storage is replaced, and the
 * write-on-success and read-on-failure it performs are the real ones.
 */
const mockCache: Record<string, string> = {};

jest.mock('@/storage/app-storage', () => ({
  appStorage: {
    getItem: jest.fn((key: string) => Promise.resolve(mockCache[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockCache[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockCache[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => Promise.resolve()),
  },
  getDeviceId: jest.fn(() => Promise.resolve('test-device-id')),
}));

import { ensureLocalProtocol, useMapSource } from '@/hooks/use-map-source';
// The one key rule, shared with the native renderer: the web renderer and the device
// cache a style document in the same place, under the same name.
import { styleCacheKey } from '@/services/map-style-cache';
import { appStorage } from '@/storage/app-storage';

const ARCHIVE = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
const ARCHIVE_ERROR = 'https://api.example/media/public/tiles/broken/v1.pmtiles';
const ARCHIVE_TILES = 'https://api.example/media/public/tiles/second/v1.pmtiles';
const ARCHIVE_STYLED = 'https://api.example/media/public/tiles/styled/v1.pmtiles';
const ARCHIVE_SWAP_FIRST = 'https://api.example/media/public/tiles/swap-first/v1.pmtiles';
const ARCHIVE_SWAP_SECOND = 'https://api.example/media/public/tiles/swap-second/v1.pmtiles';
const STYLE_ONE = 'https://api.example/media/public/styles/one.json';
const STYLE_TWO = 'https://api.example/media/public/styles/two.json';

// One archive and one style url per case: the page keeps both registries in memory, and
// a case that reused a url would observe the earlier case's cached document.
const ARCHIVE_WRITE = 'https://api.example/media/public/tiles/write/v1.pmtiles';
const ARCHIVE_CACHED = 'https://api.example/media/public/tiles/cached-style/v1.pmtiles';
const ARCHIVE_NONE = 'https://api.example/media/public/tiles/no-network/v1.pmtiles';
const ARCHIVE_UNDRAWABLE = 'https://api.example/media/public/tiles/undrawable/v1.pmtiles';
const ARCHIVE_RAW = 'https://api.example/media/public/tiles/style-raw/v1.pmtiles';
const STYLE_WRITE = 'https://api.example/media/public/styles/write.json';
const STYLE_CACHED = 'https://api.example/media/public/styles/cached.json';
const STYLE_NONE = 'https://api.example/media/public/styles/none.json';
const STYLE_UNDRAWABLE = 'https://api.example/media/public/styles/undrawable.json';
const STYLE_RAW = 'https://api.example/media/public/styles/raw.json';

/** The storage key each of the styles above is cached under (see `styleCacheKey`). */
const KEY_WRITE = 'map_style_cache_29842252';
const KEY_CACHED = 'map_style_cache_ea9748bb';
const KEY_UNDRAWABLE = 'map_style_cache_fd9f7a16';

/** Resolves a `fetch` call by hand, so a run can be left genuinely in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** An archive response: the hook reads the bytes and the PMTiles header, nothing else. */
function archiveResponse(size = 1024) {
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(size) };
}

/** A style response, as the client reads it. */
function styleResponse(document: unknown) {
  return { ok: true, json: async () => document };
}

/** A network that is not there: what the browser throws when the request cannot leave. */
function networkFailure() {
  return Promise.reject(new TypeError('Network request failed'));
}

function fakeMaplibre() {
  const protocols = new Map<string, (params: { url: string; type?: string }) => Promise<unknown>>();
  return {
    protocols,
    addProtocol: (
      scheme: string,
      handler: (params: { url: string; type?: string }) => Promise<unknown>,
    ) => {
      protocols.set(scheme, handler);
    },
  };
}

describe('useMapSource', () => {
  beforeEach(() => {
    mockGetHeader.mockReset().mockResolvedValue({
      minZoom: 0,
      maxZoom: 15,
      minLon: -64.83,
      minLat: -32.28,
      maxLon: -64.66,
      maxLat: -32.12,
    });
    mockGetZxy.mockReset();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    }) as unknown as typeof fetch;
  });

  it('downloads the archive whole and exposes a local source url', async () => {
    const { result } = await renderHook(() => useMapSource(ARCHIVE));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(globalThis.fetch).toHaveBeenCalledWith(ARCHIVE);
    expect(result.current.sourceUrl).toMatch(/^sonora:\/\//);
    expect(result.current.bytes).toBe(1024);
  });

  it('reports the failure instead of leaving the map blank', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }) as never;

    const { result } = await renderHook(() => useMapSource(ARCHIVE_ERROR));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toContain('404');
  });

  it('does not download twice for the same archive', async () => {
    const first = await renderHook(() => useMapSource(ARCHIVE));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const callsAfterFirst = (globalThis.fetch as jest.Mock).mock.calls.length;

    const second = await renderHook(() => useMapSource(ARCHIVE));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    expect((globalThis.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
  });

  it('fetches a changed style url once the archive is already cached', async () => {
    const firstStyle = { version: 8, sources: {}, layers: [] };
    const secondStyle = { version: 8, sources: { basemap: {} }, layers: [] };
    globalThis.fetch = jest.fn((url: string) => {
      if (url === ARCHIVE_STYLED) {
        return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1024) });
      }
      if (url === STYLE_ONE) return Promise.resolve({ ok: true, json: async () => firstStyle });
      if (url === STYLE_TWO) return Promise.resolve({ ok: true, json: async () => secondStyle });
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result, rerender } = await renderHook(
      ({ styleUrl }: { styleUrl: string }) => useMapSource(ARCHIVE_STYLED, styleUrl),
      { initialProps: { styleUrl: STYLE_ONE } },
    );

    await waitFor(() => expect(result.current.style).toEqual(firstStyle));

    await rerender({ styleUrl: STYLE_TWO });

    await waitFor(() => expect(result.current.style).toEqual(secondStyle));
    expect(result.current.status).toBe('ready');

    const archiveCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === ARCHIVE_STYLED,
    );
    expect(archiveCalls).toHaveLength(1);
  });

  it('never settles on a stale run when the archive url changes mid-download', async () => {
    const staleDownload = deferred<unknown>();
    const currentDownload = deferred<unknown>();
    globalThis.fetch = jest.fn((url: string) => {
      if (url === ARCHIVE_SWAP_FIRST) return staleDownload.promise;
      if (url === ARCHIVE_SWAP_SECOND) return currentDownload.promise;
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result, rerender } = await renderHook(
      ({ archiveUrl }: { archiveUrl: string }) => useMapSource(archiveUrl),
      { initialProps: { archiveUrl: ARCHIVE_SWAP_FIRST } },
    );

    // The first download is still in flight when the configured url changes.
    await rerender({ archiveUrl: ARCHIVE_SWAP_SECOND });

    currentDownload.resolve({ ok: false, status: 503, statusText: 'Unavailable' });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toContain('503');

    // The abandoned run resolves late: it must not overwrite the current result.
    staleDownload.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1024) });
    await act(async () => {
      await staleDownload.promise;
    });

    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    expect(result.current.status).toBe('error');
  });
});

const maplibre = fakeMaplibre();

describe('the local protocol', () => {
  beforeEach(() => {
    mockGetHeader.mockReset().mockResolvedValue({
      minZoom: 0,
      maxZoom: 15,
      minLon: -64.83,
      minLat: -32.28,
      maxLon: -64.66,
      maxLat: -32.12,
    });
    mockGetZxy.mockReset();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(2048),
    }) as unknown as typeof fetch;
  });

  it('answers the TileJSON request MapLibre makes first', async () => {
    const { result } = await renderHook(() => useMapSource(ARCHIVE));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    ensureLocalProtocol(maplibre);
    const handler = maplibre.protocols.get('sonora');
    expect(handler).toBeDefined();

    const response = (await handler?.({
      url: result.current.sourceUrl as string,
      type: 'json',
    })) as {
      data: { tiles: string[]; minzoom: number; maxzoom: number; bounds: number[] };
    };

    expect(response.data.tiles).toEqual([`${result.current.sourceUrl}/{z}/{x}/{y}`]);
    expect(response.data.minzoom).toBe(0);
    expect(response.data.maxzoom).toBe(15);
    expect(response.data.bounds).toEqual([-64.83, -32.28, -64.66, -32.12]);
  });

  it('reads a tile from memory, and an empty tile outside the archive', async () => {
    const { result } = await renderHook(() => useMapSource(ARCHIVE_TILES));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    ensureLocalProtocol(maplibre);
    const handler = maplibre.protocols.get('sonora');
    const key = (result.current.sourceUrl as string).replace('sonora://', '');

    mockGetZxy.mockResolvedValueOnce({ data: new Uint8Array([1, 2, 3]) });
    const tile = (await handler?.({ url: `sonora://${key}/14/8765/12345` })) as {
      data: Uint8Array;
    };
    expect(Array.from(tile.data)).toEqual([1, 2, 3]);

    mockGetZxy.mockResolvedValueOnce(undefined);
    const empty = (await handler?.({ url: `sonora://${key}/14/0/0` })) as { data: Uint8Array };
    expect(empty.data.byteLength).toBe(0);
  });
});

/**
 * The style the web renderer draws with, across a reload with no network (R12, L7).
 *
 * The style is fetched through the client cache instead of a raw `fetch`, because that
 * cache is what the experiences list already survives offline with. The archive is a
 * separate transfer and is left alone: every case here lets the archive answer so the
 * observation is about the style, which is what this slice owns.
 */
describe('the style the web renderer keeps across a reload', () => {
  const cacheStorage = appStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

  beforeEach(() => {
    for (const key of Object.keys(mockCache)) delete mockCache[key];
    cacheStorage.getItem.mockClear();
    cacheStorage.setItem.mockClear();
    mockGetHeader.mockReset().mockResolvedValue({
      minZoom: 0,
      maxZoom: 15,
      minLon: -64.83,
      minLat: -32.28,
      maxLon: -64.66,
      maxLat: -32.12,
    });
    mockGetZxy.mockReset();
  });

  it('derives the documented key from the whole style url', () => {
    // The format is pinned, not just the behaviour: a key that changed shape would orphan
    // every document a previous build had stored.
    expect(styleCacheKey(STYLE_WRITE)).toBe(KEY_WRITE);
    // Same url, same key — that is what makes the next launch find these bytes again.
    expect(styleCacheKey(STYLE_WRITE)).toBe(styleCacheKey(STYLE_WRITE));
    // A republished style and another origin are different documents, never one key.
    expect(styleCacheKey(STYLE_WRITE.replace('/write.', '/published.'))).not.toBe(KEY_WRITE);
    expect(styleCacheKey(STYLE_WRITE.replace('api.example', 'staging.example'))).not.toBe(
      KEY_WRITE,
    );
  });

  it('caches a successful style fetch under the documented key', async () => {
    const style = { version: 8, sources: {}, layers: [{ id: 'water' }] };
    globalThis.fetch = jest.fn((url: string) => {
      if (url === ARCHIVE_WRITE) return Promise.resolve(archiveResponse());
      if (url === STYLE_WRITE) return Promise.resolve(styleResponse(style));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMapSource(ARCHIVE_WRITE, STYLE_WRITE));

    // The document still reaches the map…
    await waitFor(() => expect(result.current.style).toEqual(style));
    // …and the same bytes are stored under the key this url is documented to use, which
    // is what the next cold start reads when the network cannot answer.
    await waitFor(() =>
      expect(cacheStorage.setItem).toHaveBeenCalledWith(KEY_WRITE, JSON.stringify(style)),
    );
    expect(cacheStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('returns the cached document instead of failing when the network is gone', async () => {
    const cached = { version: 8, sources: { basemap: {} }, layers: [{ id: 'land' }] };
    mockCache[KEY_CACHED] = JSON.stringify(cached);
    globalThis.fetch = jest.fn((url: string) => {
      if (url === ARCHIVE_CACHED) return Promise.resolve(archiveResponse());
      return networkFailure();
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMapSource(ARCHIVE_CACHED, STYLE_CACHED));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.style).toEqual(cached);
    expect(result.current.error).toBeUndefined();
    expect(cacheStorage.getItem).toHaveBeenCalledWith(KEY_CACHED);
  });

  it('still reports the failure on a first visit with no network and nothing cached', async () => {
    globalThis.fetch = jest.fn((url: string) => {
      if (url === ARCHIVE_NONE) return Promise.resolve(archiveResponse());
      return networkFailure();
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMapSource(ARCHIVE_NONE, STYLE_NONE));

    await waitFor(() => expect(result.current.status).toBe('error'));
    // The error the network produced, unwrapped: the storage read found nothing, so the
    // first visit fails exactly as it did before the cache existed.
    expect(result.current.error).toBe('Network request failed');
    expect(result.current.style).toBeUndefined();
  });

  it('treats a cached document that is not drawable as absent', async () => {
    // No `version`: a body MapLibre cannot draw, which must never reach the map.
    mockCache[KEY_UNDRAWABLE] = JSON.stringify({ sources: {}, layers: [{ id: 'land' }] });
    globalThis.fetch = jest.fn((url: string) => {
      if (url === ARCHIVE_UNDRAWABLE) return Promise.resolve(archiveResponse());
      return networkFailure();
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useMapSource(ARCHIVE_UNDRAWABLE, STYLE_UNDRAWABLE));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.style).toBeUndefined();
    expect(result.current.error).toContain('not a drawable document');
  });

  it('leaves the archive transfer reading the network directly', async () => {
    const style = { version: 8, sources: {}, layers: [] };
    const fetchMock = jest.fn((url: string) => {
      if (url === ARCHIVE_RAW) return Promise.resolve(archiveResponse(2048));
      if (url === STYLE_RAW) return Promise.resolve(styleResponse(style));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = await renderHook(() => useMapSource(ARCHIVE_RAW, STYLE_RAW));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.bytes).toBe(2048);
    expect(result.current.sourceUrl).toMatch(/^sonora:\/\//);

    // The archive is still one raw, whole download, with no client and no cache in front
    // of it: exactly the transfer this slice did not touch.
    const archiveCalls = fetchMock.mock.calls.filter(([url]) => url === ARCHIVE_RAW);
    expect(archiveCalls).toHaveLength(1);
    expect(archiveCalls[0]).toHaveLength(1);
  });
});
