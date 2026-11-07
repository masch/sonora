import type {
  CameraBoundsStop,
  CameraCenterStop,
  CameraRef,
  MapRef,
  PressEvent,
  PressEventWithFeatures,
  StyleSpecification,
  ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { Camera, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import type { RefObject, ReactNode } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAppTranslation } from '@/hooks/use-translation';

import { MapGestureSurface } from './map-scroll-lock';
import { UserLocationPoint } from './user-location-point';

/**
 * Every gesture the card answers, declared rather than inherited from the defaults.
 *
 * Not documentation: on Android the native view only asks its parent not to intercept
 * the touch when pan is declared (`dragPan` → `MLRNMapView.onTouchEvent`), and without
 * that ask the vertical page scroll under the card steals the drag and aborts the pinch
 * mid-gesture. The rest keep the behavior the defaults already had, so declaring them
 * changes nothing beyond the parent letting go.
 */
const CARD_GESTURES = {
  dragPan: true,
  touchZoom: true,
  doubleTapZoom: true,
  doubleTapHoldZoom: true,
  touchRotate: true,
  touchPitch: true,
} as const;

export interface MapCanvasProps {
  testID: string;
  className: string;
  /** The built style: a new object here re-applies it and re-fetches every tile. */
  style: StyleSpecification;
  mapRef: RefObject<MapRef | null>;
  cameraRef: RefObject<CameraRef | null>;
  camera: Partial<CameraCenterStop & CameraBoundsStop>;
  onPress: (event: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>) => Promise<void>;
  /** The camera's own report that a region change ended, flight or walker's pan. */
  onRegionDidChange: (event: NativeSyntheticEvent<ViewStateChangeEvent>) => void;
  /** Where the walker is, when the device knows it. */
  userCoordinates: { latitude: number; longitude: number } | undefined;
  /** Whether the walker's own label may be drawn: labels on, and glyphs to draw them. */
  labelsAllowed: boolean;
  /** Draws the one honest line over the reference plane instead of the map's silence. */
  noRegion: boolean;
  /** The caller's own surface, inside the card the drawn map owns. */
  overlay?: ReactNode;
}

/**
 * The drawn map: the native `Map`, its camera and the walker's own point.
 *
 * Separated from the renderer that waits for it because that one owns the waits, the
 * failures and the cold-start decisions, and this one owns what the walker sees once
 * there is something to see. Landing here also keeps the touch gestures and the map's
 * own accessible name in the one place that draws the map they belong to.
 */
export function MapCanvas({
  testID,
  className,
  style,
  mapRef,
  cameraRef,
  camera,
  onPress,
  onRegionDidChange,
  userCoordinates,
  labelsAllowed,
  noRegion,
  overlay,
}: MapCanvasProps) {
  const { t } = useAppTranslation();

  return (
    <MapGestureSurface testID={testID} className={className}>
      <MapLibreMap
        ref={mapRef}
        mapStyle={style}
        onPress={onPress}
        // The only report of a camera landing: the flight's, never the walker's.
        onRegionDidChange={onRegionDidChange}
        {...CARD_GESTURES}
        // The label describes the map itself: the loading key would be announced by a
        // screen reader over a map that has already drawn.
        accessibilityLabel={t('map.mapLabel')}
        testID={`${testID}-map`}
      >
        <Camera ref={cameraRef} {...camera} />
        {/* Where the walker is, when the device knows it. A source of its own rather
            than a document, so a fix every few metres never rebuilds the style: the map
            re-applies it on `mapStyle` identity, and that would re-fetch tiles. */}
        <UserLocationPoint coordinates={userCoordinates} labelsAllowed={labelsAllowed} />
      </MapLibreMap>
      {/* One honest line over the reference plane: the map is not broken, this place is
          outside the regions the app publishes. */}
      {noRegion ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          className="absolute bottom-0 left-0 right-0 bg-backgroundElement px-3 py-2 text-center"
          testID={`${testID}-no-region`}
        >
          {t('map.noRegion')}
        </ThemedText>
      ) : null}
      {overlay}
    </MapGestureSurface>
  );
}
