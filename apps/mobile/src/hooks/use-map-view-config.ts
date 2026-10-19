import type { MapSourceConfig } from '@/components/map/map-view.types';
import { resolveMapRenderer, type MapRenderer } from '@/components/map/resolve-renderer';
import { APP_CONFIG } from '@/config/app-config';
import { useRemoteConfigStore } from '@/store/remote-config-store';

export interface MapViewConfig {
  renderer: MapRenderer;
  source: MapSourceConfig;
}

/**
 * The renderer this build runs and the artifact origins it draws from.
 *
 * The renderer resolves as build-time env → remote config → leaflet: the env
 * value comes from `APP_CONFIG` (Expo only inlines literal `process.env` access,
 * so it cannot live here) and the remote half from `map.renderer`, which the API
 * normalizes per environment. The origins have always come from the remote
 * config, over the build-time floor the store starts from.
 */
export function useMapViewConfig(): MapViewConfig {
  const map = useRemoteConfigStore((state) => state.config.map);

  return {
    renderer: resolveMapRenderer(APP_CONFIG.mapRenderer, map?.renderer),
    source: {
      archiveUrl: map?.archiveUrl ?? '',
      styleUrl: map?.styleUrl || undefined,
    },
  };
}
