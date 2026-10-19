import { resolveMapRenderer } from '@/components/map/resolve-renderer';

describe('resolveMapRenderer', () => {
  it('defaults to the current Leaflet map', () => {
    expect(resolveMapRenderer(undefined)).toBe('leaflet');
    expect(resolveMapRenderer('')).toBe('leaflet');
    expect(resolveMapRenderer('something-else')).toBe('leaflet');
  });

  it('enables the new map only with the exact flag value', () => {
    expect(resolveMapRenderer('maplibre')).toBe('maplibre');
  });
});
