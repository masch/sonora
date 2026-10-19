import { renderHook, waitFor } from '@testing-library/react-native';

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
