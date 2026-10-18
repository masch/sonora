/**
 * Which map implementation to mount.
 *
 * The default is the current Leaflet map, so enabling the new one is a deliberate
 * build-time choice (`EXPO_PUBLIC_MAP_RENDERER=maplibre`) until the remote flag
 * with a version gate replaces it.
 */
export type MapRenderer = 'leaflet' | 'maplibre';

export const MAP_RENDERER_ENV = 'EXPO_PUBLIC_MAP_RENDERER';

export function resolveMapRenderer(value: string | undefined): MapRenderer {
  return value === 'maplibre' ? 'maplibre' : 'leaflet';
}
