import { renderHook } from '@testing-library/react-native';

import { useMapViewConfig } from '@/hooks/use-map-view-config';

let mockMapConfig: { archiveUrl: string; styleUrl?: string } | undefined = {
  archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
  styleUrl: 'https://api.example/media/public/styles/v1.json',
};

jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: (selector: (state: unknown) => unknown) =>
    selector({ config: { map: mockMapConfig } }),
}));

describe('useMapViewConfig', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_MAP_RENDERER;
    mockMapConfig = {
      archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.example/media/public/styles/v1.json',
    };
  });

  it('reads the renderer from the build flag and the origins from the remote config', async () => {
    process.env.EXPO_PUBLIC_MAP_RENDERER = 'maplibre';
    const enabled = await renderHook(() => useMapViewConfig());
    expect(enabled.result.current.renderer).toBe('maplibre');
    expect(enabled.result.current.source).toEqual({
      archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
      styleUrl: 'https://api.example/media/public/styles/v1.json',
    });

    delete process.env.EXPO_PUBLIC_MAP_RENDERER;
    const disabled = await renderHook(() => useMapViewConfig());
    expect(disabled.result.current.renderer).toBe('leaflet');
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
