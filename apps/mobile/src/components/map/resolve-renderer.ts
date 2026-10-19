import type { MapRenderer } from '@sonora/shared';

export type { MapRenderer };

export const MAP_RENDERER_ENV = 'EXPO_PUBLIC_MAP_RENDERER';

/**
 * Which map implementation to mount, resolved as
 * **build-time env → remote config → leaflet**.
 *
 * The env value wins when it asks for `maplibre`, because it is the explicit
 * choice of that build (it is how the device build for T7 is made); the cost is
 * that such a build cannot be turned off from the server, which is why a
 * rollout, and a rollback, go through the remote value instead.
 *
 * The remote value decides for every build that left the choice open, and only
 * when the app actually received it: an absent field, or a value the schema
 * would have rejected, means `leaflet`.
 *
 * Deliberately not version-gated. A build published before this field existed
 * never reads `map.renderer` — it ignores the unknown field and resolves from
 * its own env — and every build that does read it already bundles the native
 * module, so the case a gate would guard against cannot exist.
 *
 * @param buildRenderer the build-time value, raw or already normalized.
 * @param remoteRenderer `map.renderer` from the remote config, if any.
 */
export function resolveMapRenderer(
  buildRenderer: string | undefined,
  remoteRenderer?: unknown,
): MapRenderer {
  if (buildRenderer === 'maplibre') return 'maplibre';
  if (remoteRenderer === 'maplibre') return 'maplibre';
  return 'leaflet';
}
