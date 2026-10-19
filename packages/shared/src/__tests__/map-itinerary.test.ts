import { describe, expect, it } from 'vitest';

import { itineraryDocument } from '../map';

const origin = { latitude: -32.211913, longitude: -64.73809 };
const waypoints = [
  { latitude: -32.2119, longitude: -64.7381 },
  { latitude: -32.2118, longitude: -64.7382 },
];
const userCoordinates = { latitude: -32.2115, longitude: -64.7385 };

describe('itineraryDocument', () => {
  it('builds an experience-scoped document keyed `itinerary`', () => {
    const document = itineraryDocument({ origin });

    expect(document.key).toBe('itinerary');
    expect(document.scope).toBe('experience');
    expect(document.collection.type).toBe('FeatureCollection');
  });

  it('numbers the origin 1 and every waypoint from 2', () => {
    const document = itineraryDocument({ origin, waypoints });
    const points = document.collection.features.filter(
      (feature) => feature.geometry.type === 'Point',
    );

    expect(points[0].properties).toMatchObject({ labelKey: 'map.point', labelIndex: 1 });
    expect(points[1].properties).toMatchObject({ labelKey: 'map.point', labelIndex: 2 });
    expect(points[2].properties).toMatchObject({ labelKey: 'map.point', labelIndex: 3 });
  });

  it('writes every geometry with [longitude, latitude] coordinates', () => {
    const document = itineraryDocument({ origin, waypoints });

    expect(document.collection.features[0].geometry.coordinates).toEqual([-64.73809, -32.211913]);
    expect(document.collection.features[1].geometry.coordinates).toEqual([-64.7381, -32.2119]);
    expect(document.collection.features[2].geometry.coordinates).toEqual([-64.7382, -32.2118]);
  });

  it('draws the path through the origin and the waypoints, in order', () => {
    const document = itineraryDocument({ origin, waypoints });
    const line = document.collection.features.find(
      (feature) => feature.geometry.type === 'LineString',
    );

    expect(line?.geometry.coordinates).toEqual([
      [-64.73809, -32.211913],
      [-64.7381, -32.2119],
      [-64.7382, -32.2118],
    ]);
  });

  it('omits the path when there is no second position to join', () => {
    const document = itineraryDocument({ origin });

    expect(
      document.collection.features.some((feature) => feature.geometry.type === 'LineString'),
    ).toBe(false);
  });

  it('adds the walker position only when coordinates are known', () => {
    const withUser = itineraryDocument({ origin, userCoordinates });
    const userPoint = withUser.collection.features.find(
      (feature) => feature.properties.labelKey === 'map.userLocation',
    );

    expect(userPoint?.geometry.coordinates).toEqual([-64.7385, -32.2115]);

    const withoutUser = itineraryDocument({ origin });
    expect(
      withoutUser.collection.features.some(
        (feature) => feature.properties.labelKey === 'map.userLocation',
      ),
    ).toBe(false);
  });
});
