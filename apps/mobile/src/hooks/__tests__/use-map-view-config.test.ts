import { renderHook } from '@testing-library/react-native';

import { useMapViewConfig } from '@/hooks/use-map-view-config';

interface MockRegion {
  bbox: number[];
  label: string;
  archiveUrl: string;
  archiveBytes: number;
}

interface MockMapConfig {
  renderer?: 'leaflet' | 'maplibre';
  styleUrl: string;
  regions: Record<string, MockRegion>;
  download: {
    preload: string[];
    autoMaxBytes: number;
    cacheMaxBytes: number;
    cellular: 'ask' | 'auto' | 'never';
  };
}

const CALAMUCHITA: MockRegion = {
  bbox: [-64.83, -32.28, -64.66, -32.12],
  label: 'Valle de Calamuchita',
  archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
  archiveBytes: 4_000_000,
};

const OTRO_VALLE: MockRegion = {
  bbox: [-65.5, -33.5, -65.1, -33.1],
  label: 'Otro Valle',
  archiveUrl: 'https://api.example/media/public/tiles/otro-valle/v1.pmtiles',
  archiveBytes: 2_000_000,
};

const DOWNLOAD: MockMapConfig['download'] = {
  preload: ['calamuchita'],
  autoMaxBytes: 8_000_000,
  cacheMaxBytes: 100_000_000,
  cellular: 'ask',
};

let mockRenderer: 'leaflet' | 'maplibre' = 'maplibre';

let mockMapConfig: MockMapConfig | undefined = {
  renderer: 'maplibre',
  styleUrl: 'https://api.example/media/public/styles/v1.json',
  regions: { calamuchita: CALAMUCHITA },
  download: DOWNLOAD,
};

jest.mock('@/config/app-config', () => ({
  APP_CONFIG: {
    get mapRenderer() {
      return mockRenderer;
    },
  },
}));

jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (selector: (state: unknown) => unknown) =>
    selector({ config: { map: mockMapConfig } }),
}));

describe('useMapViewConfig', () => {
  afterEach(() => {
    mockRenderer = 'maplibre';
    mockMapConfig = {
      renderer: 'maplibre',
      styleUrl: 'https://api.example/media/public/styles/v1.json',
      regions: { calamuchita: CALAMUCHITA },
      download: DOWNLOAD,
    };
  });

  it('takes the renderer from the central app config', async () => {
    mockRenderer = 'maplibre';
    const enabled = await renderHook(() => useMapViewConfig());
    expect(enabled.result.current.renderer).toBe('maplibre');

    // A build that left the choice open falls back to Leaflet only when the
    // remote value does not claim MapLibre: the env wins by asking for MapLibre,
    // never by asking for Leaflet.
    mockRenderer = 'leaflet';
    mockMapConfig = { ...mockMapConfig!, renderer: 'leaflet' };
    const disabled = await renderHook(() => useMapViewConfig());
    expect(disabled.result.current.renderer).toBe('leaflet');
  });

  it('draws no region the server did not name to preload', async () => {
    mockMapConfig = { ...mockMapConfig!, download: { ...DOWNLOAD, preload: [] } };
    const { result } = await renderHook(() => useMapViewConfig());

    // A published region that nobody asked to preload is not guessed: R10 puts
    // that decision on the server, and T-B resolves the real region per experience.
    expect(result.current.source.archiveUrl).toBe('');
  });

  it('lets the remote value reach the renderer when the build left it open', async () => {
    mockRenderer = 'leaflet';
    mockMapConfig = { ...mockMapConfig!, renderer: 'maplibre' };
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.renderer).toBe('maplibre');
  });

  it('keeps the build-time choice when the remote value disagrees', async () => {
    mockRenderer = 'maplibre';
    mockMapConfig = { ...mockMapConfig!, renderer: 'leaflet' };
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.renderer).toBe('maplibre');
  });

  it('resolves leaflet when neither the build nor the server asks for maplibre', async () => {
    mockRenderer = 'leaflet';
    const { renderer: _renderer, ...withoutRenderer } = mockMapConfig!;
    mockMapConfig = withoutRenderer;
    const withoutRemote = await renderHook(() => useMapViewConfig());
    expect(withoutRemote.result.current.renderer).toBe('leaflet');

    mockMapConfig = undefined;
    const withoutMap = await renderHook(() => useMapViewConfig());
    expect(withoutMap.result.current.renderer).toBe('leaflet');
  });

  it('draws the region the payload preloads, not whichever region came first', async () => {
    mockMapConfig = {
      styleUrl: 'https://api.example/media/public/styles/v1.json',
      regions: { calamuchita: CALAMUCHITA, 'otro-valle': OTRO_VALLE },
      download: { ...DOWNLOAD, preload: ['otro-valle'] },
    };
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source.archiveUrl).toBe(
      'https://api.example/media/public/tiles/otro-valle/v1.pmtiles',
    );
  });

  it('draws nothing when the payload preloads nothing, even with a published region', async () => {
    mockMapConfig = {
      styleUrl: 'https://api.example/media/public/styles/v1.json',
      regions: { calamuchita: CALAMUCHITA },
      download: { ...DOWNLOAD, preload: [] },
    };
    const { result } = await renderHook(() => useMapViewConfig());

    // R10 keeps the choice on the server: a region nobody named is not guessed,
    // and T-B replaces this with the experience's own coordinates.
    expect(result.current.source.archiveUrl).toBe('');
    expect(result.current.source.styleUrl).toBe('https://api.example/media/public/styles/v1.json');
  });

  it('ignores a preload entry the catalog does not carry', async () => {
    mockMapConfig = {
      styleUrl: 'https://api.example/media/public/styles/v1.json',
      regions: { calamuchita: CALAMUCHITA },
      download: { ...DOWNLOAD, preload: ['otro-valle'] },
    };
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source.archiveUrl).toBe('');
  });

  it('sends no archive when the catalog is empty', async () => {
    mockMapConfig = { styleUrl: '', regions: {}, download: { ...DOWNLOAD, preload: [] } };
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source.archiveUrl).toBe('');
  });

  it('sends no archive when the config carries no map at all', async () => {
    mockMapConfig = undefined;
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source).toEqual({ archiveUrl: '', styleUrl: undefined });
  });

  it('reads the style url from the remote config', async () => {
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source).toEqual({
      archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.example/media/public/styles/v1.json',
    });
  });

  it('drops a style url the config left empty', async () => {
    mockMapConfig = { ...mockMapConfig!, styleUrl: '' };
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source.styleUrl).toBeUndefined();
  });
});
