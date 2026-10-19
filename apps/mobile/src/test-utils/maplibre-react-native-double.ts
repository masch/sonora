/**
 * Module-level double for `@maplibre/maplibre-react-native`, wired through jest
 * `moduleNameMapper`.
 *
 * The real package is a native module: it needs the New Architecture, a dev build
 * and a device, none of which jest has. Mapping the module to the sibling
 * `maplibre-react-native-double.tsx` keeps the component's declarative tree
 * (`Map` + `Camera`) working under test while this module records exactly what
 * the component handed over, so a suite can assert the style, the camera and the
 * press handling without a renderer.
 *
 * Kept narrow on purpose: only the two components and the one ref method this
 * repository actually uses (`MapRef.queryRenderedFeatures`) exist here. Adding a
 * member is a signal that the component started depending on something new.
 *
 * The components live in the sibling `.tsx` module; the types, the recorders and
 * the reset helper live here so that module exports components only.
 */

import type { ReactNode } from 'react';

/** The slice of a MapLibre style this double inspects. */
export interface StyleDouble {
  glyphs?: string;
  sources?: Record<string, Record<string, unknown> | undefined>;
  layers?: { id: string; type?: string }[];
}

export interface MapDoubleProps {
  mapStyle: StyleDouble;
  testID?: string;
  accessibilityLabel?: string;
  /** The component's press handler, driven by the test the way the device would. */
  onPress?: (event: { nativeEvent: { point: [number, number]; lngLat: [number, number] } }) => void;
  children?: ReactNode;
}

export interface MapDoubleRef {
  queryRenderedFeatures: (
    pointOrBounds: unknown,
    options?: { layers?: string[] },
  ) => Promise<{ properties?: Record<string, unknown> | null }[]>;
}

/**
 * The last `Map` the component rendered. The component mounts one map at a time,
 * so the recorder is replaced on every render instead of accumulating: reading it
 * always describes what is on screen now.
 */
export const mockMapProps: MapDoubleProps[] = [];

/** The last `Camera` the component rendered, for the same reason. */
export const mockCameraProps: Record<string, unknown>[] = [];

/**
 * Every `mapStyle` the map was handed, one per render, oldest first: the recorder
 * above only keeps the latest one, and a suite asking whether a re-render handed
 * the map the *same* style needs both renders to compare.
 */
export const mockMapStyles: StyleDouble[] = [];

/**
 * The hit test the map answers with. Tests set the result per layer id, so a
 * press can be aimed at one document's layer the way `queryRenderedFeatures`
 * with a `layers` filter does on a device. It is a jest mock, so the arguments
 * the component handed over — the box around the press and the layers asked for —
 * stay readable in `mock.calls` for a suite that asserts them.
 */
export const mockQueryRenderedFeatures = jest.fn<
  Promise<{ properties?: Record<string, unknown> | null }[]>,
  [unknown, { layers?: string[] }?]
>(async () => []);

/** Clears what the previous test handed to the double. */
export function resetMapDouble(): void {
  mockMapProps.length = 0;
  mockCameraProps.length = 0;
  mockMapStyles.length = 0;
  mockQueryRenderedFeatures.mockReset();
  // Default: nothing drawn is under the press.
  mockQueryRenderedFeatures.mockImplementation(async () => []);
}

/** Answers every hit test with a feature from the given layer id only. */
export function mockHit(layerId: string, properties: Record<string, unknown>): void {
  mockQueryRenderedFeatures.mockImplementation(
    async (_pointOrBounds: unknown, options?: { layers?: string[] }) =>
      options?.layers?.includes(layerId) ? [{ properties }] : [],
  );
}
