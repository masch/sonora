import type { LayerProps } from '@maplibre/maplibre-react-native';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import {
  USER_LOCATION_SOURCE_ID,
  userLocationGeoJson,
  userLocationStyleLayers,
  type UserLocationCoordinates,
} from '@sonora/shared';

import { useAppTranslation } from '@/hooks/use-translation';

/** No point, no layers: the map draws the walker or nothing at all. */
const NO_SOURCE_ID = USER_LOCATION_SOURCE_ID;

/**
 * The walker's own point, drawn apart from every document.
 *
 * A component of its own for two reasons. The first is the map that mounts it: a source
 * built inline would add a branch to a component that is already the longest in this
 * directory. The second is the walker's name, which is translated here, where React can
 * call the translation layer: MapLibre cannot, so a style built from values could only
 * have it in the language of the build.
 */
export interface UserLocationPointProps {
  coordinates: UserLocationCoordinates | undefined;
  /**
   * Whether the label may be drawn at all.
   *
   * The caller answers with what the map knows: labels switched off, or a style with no
   * glyphs source, are both "no" — a symbol layer there draws nothing and reports it.
   */
  labelsAllowed: boolean;
}

export function UserLocationPoint({ coordinates, labelsAllowed }: UserLocationPointProps) {
  const { t } = useAppTranslation();
  const label = labelsAllowed ? t('map.userLocation') : undefined;

  // Memoized because a `data` object rebuilt on every render is a source told to move
  // when nothing moved: the map reconciles it by identity.
  const data = useMemo(() => userLocationGeoJson(coordinates, label), [coordinates, label]);
  const layers = useMemo(
    () => userLocationStyleLayers({ includeLabel: label !== undefined }),
    [label],
  );

  if (!coordinates) return null;

  return (
    <GeoJSONSource id={NO_SOURCE_ID} data={data}>
      {layers.map((layer) => (
        <Layer key={layer.id} {...(layer as unknown as LayerProps)} />
      ))}
    </GeoJSONSource>
  );
}
