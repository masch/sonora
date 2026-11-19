import type { MapHandle, RenderedFeature } from './use-web-map-instance';

/** What the caller of the web renderer receives when a press resolves. */
export type WebClusterHandler = (
  reference:
    | { documentKey: string; cluster: { longitude: number; latitude: number } }
    | { documentKey: string; experienceSlug: string },
) => void;

/**
 * Answers a tap on a cluster, on the web renderer.
 *
 * A cluster first tries the zoom it can answer with: supercluster says how far out
 * the group's members separate, and a flight there replaces the aggregate with the
 * dots it held. A cluster that cannot expand any further — two experiences published
 * on the same GPS point — has no zoom left, and the caller decides what a tap on it
 * means instead.
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
    handler({ documentKey, cluster: clusterCenter });
    return;
  }
  void expand
    .call(source, clusterId)
    .then((zoom) => {
      if (zoom > (map.getZoom?.() ?? 0)) {
        map.easeTo?.({ center: [longitude ?? 0, latitude ?? 0], zoom });
        return;
      }
      handler({ documentKey, cluster: clusterCenter });
    })
    .catch(() => handler({ documentKey, cluster: clusterCenter }));
}
