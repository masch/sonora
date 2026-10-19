import type { MapSourceConfig } from '@/components/map/map-view.types';
import type { MapRenderer } from '@/components/map/resolve-renderer';
import { APP_CONFIG } from '@/config/app-config';
import { useRemoteConfigStore } from '@/store/remote-config-store';

export interface MapViewConfig {
  renderer: MapRenderer;
  source: MapSourceConfig;
}

/**
 * The renderer this build runs and the artifact origins it draws from.
 *
 * Both come from the central configuration: the renderer is resolved once in
 * `APP_CONFIG` from the build-time flag (Expo only inlines literal `process.env`
 * access, so it cannot live here), and the origins come from the remote config.
 */
export function useMapViewConfig(): MapViewConfig {
  const map = useRemoteConfigStore((state) => state.config.map);

  return {
    renderer: APP_CONFIG.mapRenderer,
    source: {
      archiveUrl: map?.archiveUrl ?? '',
      styleUrl: map?.styleUrl || undefined,
    },
  };
}
