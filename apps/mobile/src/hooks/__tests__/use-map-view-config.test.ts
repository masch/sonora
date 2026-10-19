import { renderHook } from '@testing-library/react-native';

import { useMapViewConfig } from '@/hooks/use-map-view-config';

let mockRenderer: 'leaflet' | 'maplibre' = 'maplibre';

let mockMapConfig: { archiveUrl: string; styleUrl?: string } | undefined = {
  archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
  styleUrl: 'https://api.example/media/public/styles/v1.json',
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
      archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.example/media/public/styles/v1.json',
    };
  });

  it('takes the renderer from the central app config', async () => {
    mockRenderer = 'maplibre';
    const enabled = await renderHook(() => useMapViewConfig());
    expect(enabled.result.current.renderer).toBe('maplibre');

    mockRenderer = 'leaflet';
    const disabled = await renderHook(() => useMapViewConfig());
    expect(disabled.result.current.renderer).toBe('leaflet');
  });

  it('reads the origins from the remote config', async () => {
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source).toEqual({
      archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.example/media/public/styles/v1.json',
    });
  });

  it('sends an empty archive url and no style when the config carries no map', async () => {
    mockMapConfig = undefined;
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source).toEqual({ archiveUrl: '', styleUrl: undefined });
  });

  it('drops a style url the config left empty', async () => {
    mockMapConfig = { archiveUrl: 'https://api.example/tiles/a.pmtiles', styleUrl: '' };
    const { result } = await renderHook(() => useMapViewConfig());

    expect(result.current.source).toEqual({
      archiveUrl: 'https://api.example/tiles/a.pmtiles',
      styleUrl: undefined,
    });
  });
});
