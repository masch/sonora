import { describe, expect, it } from 'vitest';

import {
  USER_LOCATION_COLOR,
  USER_LOCATION_DOT_LAYER_ID,
  USER_LOCATION_HALO_LAYER_ID,
  USER_LOCATION_LABEL_LAYER_ID,
  USER_LOCATION_SOURCE_ID,
  userLocationGeoJson,
  userLocationStyleLayers,
} from '../map/user-location';

describe('userLocationGeoJson', () => {
  it('writes the position as [longitude, latitude]', () => {
    const collection = userLocationGeoJson({ latitude: -32.212, longitude: -64.738 });

    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry.coordinates).toEqual([-64.738, -32.212]);
  });

  it('draws nothing when no fix has arrived', () => {
    expect(userLocationGeoJson(null).features).toEqual([]);
    expect(userLocationGeoJson(undefined).features).toEqual([]);
  });

  it('carries no tap target, and a label only when it is given one', () => {
    const [bare] = userLocationGeoJson({ latitude: 1, longitude: 2 }).features;
    const [named] = userLocationGeoJson({ latitude: 1, longitude: 2 }, 'Tu ubicación').features;

    // No `experienceSlug` and no description: nothing on this point can be opened.
    expect(bare?.properties).toEqual({});
    expect(named?.properties).toEqual({ labelText: 'Tu ubicación' });
  });
});

describe('userLocationStyleLayers', () => {
  it('draws the halo under the dot, both from the same source', () => {
    const layers = userLocationStyleLayers();

    expect(layers.map((layer) => layer.id)).toEqual([
      USER_LOCATION_HALO_LAYER_ID,
      USER_LOCATION_DOT_LAYER_ID,
    ]);
    expect(layers.every((layer) => layer.source === USER_LOCATION_SOURCE_ID)).toBe(true);
    expect(layers.every((layer) => layer.type === 'circle')).toBe(true);
  });

  it('rings the dot in white and leaves the halo translucent', () => {
    const [halo, dot] = userLocationStyleLayers();

    expect(dot?.paint).toMatchObject({
      'circle-color': USER_LOCATION_COLOR,
      'circle-stroke-color': '#ffffff',
    });
    expect(halo?.paint).toMatchObject({
      'circle-color': USER_LOCATION_COLOR,
      'circle-opacity': 0.16,
    });
    expect(halo?.paint?.['circle-stroke-color']).toBeUndefined();
  });

  it('names the source the caller asked for, so a second map cannot collide', () => {
    expect(userLocationStyleLayers({ sourceId: 'user-location:other' })[0]?.source).toBe(
      'user-location:other',
    );
  });

  it('draws the walker their own name only when the caller asks for it', () => {
    const plain = userLocationStyleLayers();
    const named = userLocationStyleLayers({ includeLabel: true });

    expect(plain.map((layer) => layer.id)).not.toContain(USER_LOCATION_LABEL_LAYER_ID);
    expect(named.map((layer) => layer.id)).toEqual([
      USER_LOCATION_HALO_LAYER_ID,
      USER_LOCATION_DOT_LAYER_ID,
      USER_LOCATION_LABEL_LAYER_ID,
    ]);
  });

  it('reads the label off the feature, under the dot, with a halo', () => {
    const label = userLocationStyleLayers({ includeLabel: true }).at(-1);

    expect(label?.type).toBe('symbol');
    expect(label?.layout).toMatchObject({
      'text-field': ['get', 'labelText'],
      'text-anchor': 'top',
    });
    expect(label?.paint).toMatchObject({
      'text-color': USER_LOCATION_COLOR,
      'text-halo-color': '#ffffff',
    });
  });
});
