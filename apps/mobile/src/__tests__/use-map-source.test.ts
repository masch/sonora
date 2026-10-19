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

import { ensureLocalProtocol, useMapSource } from '@/hooks/use-map-source';

const ARCHIVE = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
const ARCHIVE_ERROR = 'https://api.example/media/public/tiles/broken/v1.pmtiles';
const ARCHIVE_TILES = 'https://api.example/media/public/tiles/second/v1.pmtiles';
const ARCHIVE_STYLED = 'https://api.example/media/public/tiles/styled/v1.pmtiles';
const ARCHIVE_SWAP_FIRST = 'https://api.example/media/public/tiles/swap-first/v1.pmtiles';
const ARCHIVE_SWAP_SECOND = 'https://api.example/media/public/tiles/swap-second/v1.pmtiles';
const STYLE_ONE = 'https://api.example/media/public/styles/one.json';
const STYLE_TWO = 'https://api.example/media/public/styles/two.json';

/** Resolves a `fetch` call by hand, so a run can be left genuinely in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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
