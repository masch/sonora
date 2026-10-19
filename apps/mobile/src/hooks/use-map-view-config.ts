import type { MapSourceConfig } from '@/components/map/map-view.types';
import { resolveMapRenderer, type MapRenderer } from '@/components/map/resolve-renderer';
import { useRemoteConfigStore } from '@/store/remote-config-store';

export interface MapViewConfig {
  renderer: MapRenderer;
  source: MapSourceConfig;
}

/**
 * The renderer this build runs and the artifact origins it draws from.
 *
 * Both live here so a screen only mounts a map: the renderer is a build-time
 * choice (Expo only inlines literal `process.env` access, not a computed
 * constant) and the origins come from the remote config.
 */
export function useMapViewConfig(): MapViewConfig {
  const renderer = resolveMapRenderer(process.env.EXPO_PUBLIC_MAP_RENDERER);
  const map = useRemoteConfigStore((state) => state.config.map);

  return {
    renderer,
    source: {
      archiveUrl: map?.archiveUrl ?? '',
      styleUrl: map?.styleUrl || undefined,
    },
  };
}
