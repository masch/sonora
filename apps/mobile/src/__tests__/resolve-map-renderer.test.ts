import { resolveMapRenderer } from '@/components/map/resolve-renderer';

/**
 * The full resolution matrix: the build-time env value as `APP_CONFIG` resolves
 * it (never the raw string, except for the last case), against every remote
 * value the app can receive.
 */
describe('resolveMapRenderer', () => {
  describe('build-time env unset', () => {
    it('takes the remote value when the server asks for maplibre', () => {
      expect(resolveMapRenderer(undefined, 'maplibre')).toBe('maplibre');
      expect(resolveMapRenderer('leaflet', 'maplibre')).toBe('maplibre');
    });

    it('keeps leaflet when the remote value is leaflet', () => {
      expect(resolveMapRenderer(undefined, 'leaflet')).toBe('leaflet');
    });

    it('defaults to leaflet when the payload carries no renderer', () => {
      expect(resolveMapRenderer(undefined, undefined)).toBe('leaflet');
    });

    it('defaults to leaflet when the remote value is not one the schema accepts', () => {
      for (const value of ['webgl', 'MapLibre', '', 0, null, {}, ['maplibre']]) {
        expect({ value, renderer: resolveMapRenderer(undefined, value) }).toEqual({
          value,
          renderer: 'leaflet',
        });
      }
    });
  });

  describe('build-time env asks for maplibre', () => {
    it('wins over every remote value, including its absence', () => {
      for (const remote of ['maplibre', 'leaflet', undefined, 'webgl']) {
        expect({ remote, renderer: resolveMapRenderer('maplibre', remote) }).toEqual({
          remote,
          renderer: 'maplibre',
        });
      }
    });
  });

  describe('raw env values', () => {
    it('only the exact maplibre value opts a build in', () => {
      expect(resolveMapRenderer('maplibre')).toBe('maplibre');
      for (const value of [undefined, '', 'leaflet', 'MapLibre', 'maplibre ', 'webgl']) {
        expect({ value, renderer: resolveMapRenderer(value) }).toEqual({
          value,
          renderer: 'leaflet',
        });
      }
    });
  });
});
