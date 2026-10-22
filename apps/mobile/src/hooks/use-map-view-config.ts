import type { MapSourceConfig } from '@/components/map/map-view.types';
import { resolveMapRenderer, type MapRenderer } from '@/components/map/resolve-renderer';
import { APP_CONFIG } from '@/config/app-config';
import { useRemoteConfigStore } from '@/store/remote-config-store';

export interface MapViewConfig {
  renderer: MapRenderer;
  source: MapSourceConfig;
}

/**
 * The renderer this build runs and the region it draws.
 *
 * The renderer resolves as build-time env → remote config → leaflet: the env
 * value comes from `APP_CONFIG` (Expo only inlines literal `process.env` access,
 * so it cannot live here) and the remote half from `map.renderer`, which the API
 * normalizes per environment.
 *
 * The archive comes from the catalog the server published, never from a
 * build-time url. Until T-B passes the experience's own coordinates, the region
 * is the first entry of `download.preload`, else none; T-B replaces this
 * heuristic with `regionForPoint` over the experience's coordinates.
 */
export function useMapViewConfig(): MapViewConfig {
  const map = useRemoteConfigStore((state) => state.config.map);

  const regions = map?.regions ?? {};
  // Only a region the server named to preload is drawn: guessing another one would
  // show a map the user did not ask for, and R10 keeps that decision on the server.
  const preloaded = map?.download?.preload?.[0];
  const region = preloaded && preloaded in regions ? regions[preloaded] : undefined;

  return {
    renderer: resolveMapRenderer(APP_CONFIG.mapRenderer, map?.renderer),
    source: {
      archiveUrl: region?.archiveUrl ?? '',
      styleUrl: map?.styleUrl || undefined,
    },
  };
}
