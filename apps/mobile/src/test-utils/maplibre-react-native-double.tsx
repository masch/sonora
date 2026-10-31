/**
 * The `Map` and `Camera` components of the `@maplibre/maplibre-react-native`
 * double wired through jest `moduleNameMapper` (see the sibling `.ts` module for
 * what the double is for and what it records).
 *
 * This module exports components only: every recorder, every type and the reset
 * helper live in `maplibre-react-native-double.ts`, which a suite imports
 * directly.
 */

import { useEffect, useImperativeHandle, type Ref } from 'react';
import { View } from 'react-native';

import {
  mockCameraFlights,
  mockCameraProps,
  mockMapProps,
  mockMapStyles,
  mockMapZoom,
  mockQueryRenderedFeatures,
  type CameraDoubleRef,
  type MapDoubleProps,
  type MapDoubleRef,
} from './maplibre-react-native-double';

export function Map(props: MapDoubleProps & { ref?: Ref<MapDoubleRef> }) {
  const { ref, mapStyle, onPress, testID, accessibilityLabel, children } = props;

  useImperativeHandle(
    ref,
    () => ({
      queryRenderedFeatures: mockQueryRenderedFeatures,
      // Read through the module value, not captured: a suite sets the zoom before
      // the component asks, and the answer has to be the one it set.
      getZoom: async () => mockMapZoom,
    }),
    [],
  );

  // Recorded from an effect, not while rendering: the compiler forbids mutating a
  // module value during render, and `render()` flushes effects before a test asserts.
  useEffect(() => {
    mockMapProps.length = 0;
    mockMapProps.push({ mapStyle, onPress, testID, accessibilityLabel });
  }, [mapStyle, onPress, testID, accessibilityLabel]);

  // Recorded after every render, not only when the style changes: the question a
  // suite asks is what the map was handed by this render.
  useEffect(() => {
    mockMapStyles.push(mapStyle);
  });

  // The real component renders a `View` wrapper and needs an on-layout pass
  // before it mounts the native map; the double is ready immediately.
  return <View testID={testID}>{children}</View>;
}

export function Camera(props: Record<string, unknown> & { ref?: Ref<CameraDoubleRef> }) {
  const { ref, ...cameraProps } = props;

  // The one imperative move the component makes: recorded as the options object the
  // real `CameraRef.flyTo` receives, because that object is the decision under test.
  useImperativeHandle(ref, () => ({ flyTo: (options) => mockCameraFlights.push(options) }), []);

  useEffect(() => {
    mockCameraProps.length = 0;
    // `ref` is stripped so an assertion on the camera's declarative props keeps
    // comparing the camera options and nothing else.
    mockCameraProps.push(cameraProps);
  });

  return null;
}
