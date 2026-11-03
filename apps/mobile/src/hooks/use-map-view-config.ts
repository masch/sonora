import { regionForPoint, type MapPoint } from '@sonora/shared';

import type { MapSourceConfig } from '@/components/map/map-view.types';
import { resolveMapRenderer, type MapRenderer } from '@/components/map/resolve-renderer';
import { APP_CONFIG } from '@/config/app-config';
import { archiveIdentity } from '@/services/map-archives';
import { useRemoteConfigStore } from '@/store/remote-config-store';

export interface MapViewConfig {
  renderer: MapRenderer;
  /** The region the experience's point falls in, or `null` when it falls in none. */
  regionKey: string | null;
  source: MapSourceConfig;
}

/**
 * The renderer this build runs and the region the experience belongs to.
 *
 * The renderer resolves as build-time env → remote config → leaflet: the env
 * value comes from `APP_CONFIG` (Expo only inlines literal `process.env` access,
 * so it cannot live here) and the remote half from `map.renderer`, which the API
 * normalizes per environment.
 *
 * The region is resolved from the experience's own coordinates against the
 * catalog the server published — never from a build-time url and never from
 * `download.preload`, which decides what the app *downloads*, not what a map
 * draws. A point outside every published box resolves `null`: the map then draws
 * its reference plane over the fallback style and says so, instead of showing a
 * map of somewhere the walker is not.
 *
 * `regionKey` is also carried on `source`, and so are the selector's group list and
 * its `showLayersControl` flag, because each of them is a decision about what this map
 * draws — which archive, which groups, whether the walker is offered the choice at all
 * — and the map components take the source as their only input. The archive's version
 * and advertised size ride there for the same reason: the sheet that names the loaded
 * map is a statement about this decision, and it is resolved here, where the region is,
 * instead of being re-derived by a control that would have to read the config itself.
 *
 * The version is read from the archive's own url and never from the style url, even
 * though both end in a version segment: the archive is what the renderer reads, so it
 * is the only one that can decide which tiles the walker is looking at.
 */
export function useMapViewConfig(point?: MapPoint | null): MapViewConfig {
  const map = useRemoteConfigStore((state) => state.config.map);

  const regions = map?.regions ?? {};
  const regionKey = regionForPoint(regions, point);
  const region = regionKey === null ? undefined : regions[regionKey];
  const archiveUrl = region?.archiveUrl ?? '';

  return {
    renderer: resolveMapRenderer(APP_CONFIG.mapRenderer, map?.renderer),
    regionKey,
    source: {
      regionKey,
      archiveUrl,
      // `null` when the url is not one this app keys by version: the sheet then says
      // what it does know instead of inventing a `v0`.
      archiveVersion: archiveIdentity(archiveUrl, regionKey)?.version ?? null,
      archiveBytes: region?.archiveBytes,
      styleUrl: map?.styleUrl || undefined,
      layers: map?.layers?.groups,
      showLayersControl: map?.layers?.showControl,
    },
  };
}
