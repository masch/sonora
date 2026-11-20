import { WORLD_CLUSTER_CONFIG } from '@sonora/shared';

import type { MapHandle, RenderedFeature } from './use-web-map-instance';

/** What the caller of the web renderer receives when a press resolves. */
export type WebClusterHandler = (
  reference:
    | { documentKey: string; cluster: { longitude: number; latitude: number; zoom: number } }
    | { documentKey: string; experienceSlug: string },
) => void;

/**
 * Answers a tap on a cluster, on the web renderer.
 *
 * A cluster first tries the zoom it can answer with: supercluster says how far out
 * the group's members separate, and a flight there replaces the aggregate with the
 * dots it held. A cluster whose expansion zoom lies past the source's clustering
 * ceiling — two experiences published on the same GPS point, whose coordinates no
 * camera can separate — has no zoom to answer with, so the caller opens the picker
 * for the places it holds instead of flying the walker into a wall.
 */
export function openWebCluster(
  map: MapHandle,
  feature: RenderedFeature,
  documentKey: string,
  sourceId: string,
  handler: WebClusterHandler,
): void {
  const pointCount = feature.properties.point_count;
  if (typeof pointCount !== 'number') return;

  const [longitude, latitude] = feature.geometry?.coordinates ?? [];
  const clusterCenter = { longitude: longitude ?? 0, latitude: latitude ?? 0 };
  const source = map.getSource(sourceId);
  const expand = source?.getClusterExpansionZoom;
  const clusterId = feature.properties.cluster_id;
  if (!expand || typeof clusterId !== 'number') {
    handler({
      documentKey,
      cluster: { ...clusterCenter, zoom: map.getZoom() },
    });
    return;
  }
  void expand
    .call(source, clusterId)
    .then((zoom) => {
      // A cluster that cannot separate inside the source's own ceiling is a shared
      // place: flying there would arrive at an aggregate that never opens. The
      // ceiling is read from the same constant the style build configures, so the
      // two can never drift apart.
      if (zoom <= WORLD_CLUSTER_CONFIG.maxZoom && zoom > map.getZoom()) {
        map.easeTo({ center: [longitude ?? 0, latitude ?? 0], zoom });
        return;
      }
      handler({ documentKey, cluster: { ...clusterCenter, zoom: map.getZoom() } });
    })
    .catch(() => handler({ documentKey, cluster: { ...clusterCenter, zoom: map.getZoom() } }));
}
