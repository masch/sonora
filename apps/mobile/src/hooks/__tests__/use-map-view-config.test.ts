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
  /** The selector's payload: the flag that offers the control, and the groups. */
  layers?: {
    showControl: boolean;
    groups?: { id: string; defaultVisible: boolean }[];
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

/** A point inside `calamuchita`'s box. */
const IN_CALAMUCHITA = { latitude: -32.2, longitude: -64.7 };

/** A point inside `otro-valle`'s box. */
const IN_OTRO_VALLE = { latitude: -33.3, longitude: -65.3 };

/** A point no published box holds. */
const OUTSIDE_EVERY_REGION = { latitude: 0, longitude: 0 };

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

  it("resolves the region whose box holds the experience's point, whatever the payload preloads", async () => {
    // R10 decides what the app *downloads*; it does not decide what the map draws.
    // The experience's own coordinates pick the region, so a preload list that
    // names nothing still draws the region the walker is standing in.
    mockMapConfig = { ...mockMapConfig!, download: { ...DOWNLOAD, preload: [] } };
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.regionKey).toBe('calamuchita');
    expect(result.current.source.archiveUrl).toBe(CALAMUCHITA.archiveUrl);
    expect(result.current.source.regionKey).toBe('calamuchita');
  });

  it('draws the region the point is in, not the one the payload preloads', async () => {
    mockMapConfig = {
      styleUrl: 'https://api.example/media/public/styles/v1.json',
      regions: { calamuchita: CALAMUCHITA, 'otro-valle': OTRO_VALLE },
      download: { ...DOWNLOAD, preload: ['calamuchita'] },
    };
    const { result } = await renderHook(() => useMapViewConfig(IN_OTRO_VALLE));

    expect(result.current.regionKey).toBe('otro-valle');
    expect(result.current.source.archiveUrl).toBe(OTRO_VALLE.archiveUrl);
  });

  it('resolves no region when the point falls outside every published box', async () => {
    mockMapConfig = {
      styleUrl: 'https://api.example/media/public/styles/v1.json',
      regions: { calamuchita: CALAMUCHITA, 'otro-valle': OTRO_VALLE },
      download: DOWNLOAD,
    };
    const { result } = await renderHook(() => useMapViewConfig(OUTSIDE_EVERY_REGION));

    // No nearest-region guess: the map says the point belongs to no region and
    // draws its reference plane over the fallback style.
    expect(result.current.regionKey).toBeNull();
    expect(result.current.source.regionKey).toBeNull();
    expect(result.current.source.archiveUrl).toBe('');
    // The style is region-independent, so it is still the one the server published.
    expect(result.current.source.styleUrl).toBe('https://api.example/media/public/styles/v1.json');
  });

  it('resolves no region when the caller has no point to place', async () => {
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.regionKey).toBeNull();
    expect(result.current.source.archiveUrl).toBe('');
  });

  it('resolves no region when the catalog is empty, even for a point inside its box', async () => {
    mockMapConfig = { styleUrl: '', regions: {}, download: { ...DOWNLOAD, preload: [] } };
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.regionKey).toBeNull();
    expect(result.current.source.archiveUrl).toBe('');
  });

  it('lets the remote value reach the renderer when the build left it open', async () => {
    mockRenderer = 'leaflet';
    mockMapConfig = { ...mockMapConfig!, renderer: 'maplibre' };
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.renderer).toBe('maplibre');
  });

  it('keeps the build-time choice when the remote value disagrees', async () => {
    mockRenderer = 'maplibre';
    mockMapConfig = { ...mockMapConfig!, renderer: 'leaflet' };
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.renderer).toBe('maplibre');
  });

  it('resolves leaflet when neither the build nor the server asks for maplibre', async () => {
    mockRenderer = 'leaflet';
    const { renderer: _renderer, ...withoutRenderer } = mockMapConfig!;
    mockMapConfig = withoutRenderer;
    const withoutRemote = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));
    expect(withoutRemote.result.current.renderer).toBe('leaflet');

    mockMapConfig = undefined;
    const withoutMap = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));
    expect(withoutMap.result.current.renderer).toBe('leaflet');
  });

  it('sends no archive and no region when the config carries no map at all', async () => {
    mockMapConfig = undefined;
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.regionKey).toBeNull();
    expect(result.current.source).toEqual({
      archiveUrl: '',
      styleUrl: undefined,
      regionKey: null,
    });
  });

  it('reads the archive and the style url from the remote config', async () => {
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.source).toEqual({
      archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.example/media/public/styles/v1.json',
      regionKey: 'calamuchita',
    });
  });

  it('drops a style url the config left empty', async () => {
    mockMapConfig = { ...mockMapConfig!, styleUrl: '' };
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.source.styleUrl).toBeUndefined();
    expect(result.current.source.archiveUrl).toBe(CALAMUCHITA.archiveUrl);
  });

  it("carries the payload's layer control flag onto the source", async () => {
    // The switch reads the flag off the source, like it reads the groups: the map
    // components take the source as their only input.
    mockMapConfig = {
      ...mockMapConfig!,
      layers: { showControl: true, groups: [{ id: 'water', defaultVisible: false }] },
    };
    const { result } = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));

    expect(result.current.source.showLayersControl).toBe(true);
    expect(result.current.source.layers).toEqual([{ id: 'water', defaultVisible: false }]);
  });

  it('carries no layer control flag when the payload withholds it', async () => {
    // Absent and false both leave the source without a flag the switch could read as
    // true, so the control stays off until the payload asks for it.
    mockMapConfig = { ...mockMapConfig!, layers: { showControl: false } };
    const off = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));
    expect(off.result.current.source.showLayersControl).toBe(false);

    const { layers: _layers, ...withoutLayers } = mockMapConfig;
    mockMapConfig = withoutLayers;
    const absent = await renderHook(() => useMapViewConfig(IN_CALAMUCHITA));
    expect(absent.result.current.source.showLayersControl).toBeUndefined();
    expect(absent.result.current.source.showLayersControl ?? false).toBe(false);
  });
});
