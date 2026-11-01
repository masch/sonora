import { describe, expect, it } from 'vitest';

import {
  WORLD_MIN_SPAN_DEGREES,
  WORLD_PATH_PREFIX,
  WORLD_POINTS_DOCUMENT_KEY,
  WORLD_POINT_COLORS,
  filterWorldExperiences,
  movableLabelsForDocument,
  worldCameraBounds,
  worldDocuments,
  worldDurationLabel,
  worldPointLabel,
  worldPriceLabel,
  type WorldExperience,
} from '../map/world';
import { ITINERARY_DOCUMENT_KEY } from '../map/itinerary';
import { formatPrice } from '../utils/format-price';

/**
 * The app's translation layer, faked: these tests are about what the label says
 * and in which pieces, not about the words a locale file happens to hold.
 */
const translate = (key: string, options?: Record<string, unknown>): string => {
  const table: Record<string, string> = {
    'map.world.labelDuration': `${options?.minutes} min`,
    'map.world.labelSeconds': `${options?.seconds} s`,
    'map.world.free': 'Gratis',
  };
  const value = table[key];
  if (value === undefined) throw new Error(`unexpected key: ${key}`);
  return value;
};

const trip: WorldExperience = {
  slug: 'umepay-bosque',
  title: 'DERIVA DEL BOSQUE AL RÍO',
  format: 'trip',
  latitude: -32.211913,
  longitude: -64.73809,
  durationSeconds: 2539,
  free: false,
  price: 2200000,
  currency: 'ARS',
  waypoints: [
    { latitude: -32.212488, longitude: -64.736874 },
    { latitude: -32.21333, longitude: -64.736273 },
  ],
};

const track: WorldExperience = {
  slug: 'texto-maga',
  title: 'En Nogales, una vez',
  format: 'track',
  latitude: -32.191576848045585,
  longitude: -64.75240243117017,
  durationSeconds: 193,
  free: true,
};

describe('worldDurationLabel', () => {
  it('says seconds below a minute and minutes from a minute up', () => {
    expect(worldDurationLabel(45, translate)).toBe('45 s');
    expect(worldDurationLabel(59, translate)).toBe('59 s');
    expect(worldDurationLabel(60, translate)).toBe('1 min');
    expect(worldDurationLabel(2539, translate)).toBe('42 min');
  });

  it('contributes nothing for a duration nobody can read', () => {
    expect(worldDurationLabel(0, translate)).toBe('');
    expect(worldDurationLabel(-30, translate)).toBe('');
    expect(worldDurationLabel(Number.NaN, translate)).toBe('');
  });
});

describe('worldPriceLabel', () => {
  it('says the free word for a free experience', () => {
    expect(worldPriceLabel(track, translate)).toBe('Gratis');
  });

  it('formats a price stored in minor units', () => {
    expect(worldPriceLabel(trip, translate)).toBe(formatPrice(2200000, 'ARS'));
  });

  it('contributes nothing when the payload carries no price', () => {
    expect(worldPriceLabel({ ...trip, price: null }, translate)).toBe('');
  });
});

describe('worldPointLabel', () => {
  it('is the title and nothing else', () => {
    // The map is a place, not a list: duration and price are the preview's job, where
    // there is room for them and they survive the map's own collision rule.
    expect(worldPointLabel(trip)).toBe('DERIVA DEL BOSQUE AL RÍO');
    expect(worldPointLabel(track)).toBe('En Nogales, una vez');
  });
});

describe('worldDocuments', () => {
  const documents = worldDocuments([trip, track], { language: 'es' });

  it('draws one points document, one point per experience', () => {
    const points = documents[0];
    expect(points?.key).toBe(WORLD_POINTS_DOCUMENT_KEY);
    expect(points?.collection.features).toHaveLength(2);
    expect(points?.collection.features[0]?.geometry).toEqual({
      type: 'Point',
      coordinates: [trip.longitude, trip.latitude],
    });
  });

  it('carries the label in the active language and the slug the tap resolves', () => {
    const feature = documents[0]?.collection.features[1];
    expect(feature?.properties.label).toEqual({ es: 'En Nogales, una vez' });
    expect(feature?.properties.experienceSlug).toBe('texto-maga');
    expect(feature?.properties.color).toBe(WORLD_POINT_COLORS.track);
  });

  it('draws a point in the palette the caller passes, and labels it in the given ink', () => {
    // The app decides what a format looks like; the world asks for that table instead of
    // keeping its own opinion, because a second opinion is how a card and a point end up
    // disagreeing about the colour of a Deriva.
    const palette = worldDocuments([trip, track], {
      language: 'es',
      colors: { trip: '#7BE5C4', track: '#A1C4FD' },
      labelColor: '#18181b',
    });
    const [tripFeature, trackFeature] = palette[0]?.collection.features ?? [];
    expect(tripFeature?.properties.color).toBe('#7BE5C4');
    expect(trackFeature?.properties.color).toBe('#A1C4FD');
    expect(tripFeature?.properties.labelColor).toBe('#18181b');
  });

  it('keeps the built-in colours when the caller brings no palette', () => {
    const plain = worldDocuments([track], { language: 'es' });
    const feature = plain[0]?.collection.features[0];
    expect(feature?.properties.color).toBe(WORLD_POINT_COLORS.track);
    expect(feature?.properties.labelColor).toBeUndefined();
  });

  it('draws one path per trip, starting at its origin and under the points', () => {
    const paths = documents.filter((document) => document.key.startsWith(WORLD_PATH_PREFIX));
    expect(paths).toHaveLength(1);
    expect(paths[0]?.key).toBe(`${WORLD_PATH_PREFIX}${trip.slug}`);
    expect(paths[0]?.zIndex).toBe(-1);
    expect(paths[0]?.collection.features[0]?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [trip.longitude, trip.latitude],
        [-64.736874, -32.212488],
        [-64.736273, -32.21333],
      ],
    });
  });

  it('draws no path for a trip without stops, and none for a track', () => {
    const keys = worldDocuments([{ ...trip, waypoints: [] }, track], {
      language: 'es',
      translate,
    }).map((document) => document.key);
    expect(keys).toEqual([WORLD_POINTS_DOCUMENT_KEY]);
  });

  it('gives a trip the label priority, so a crowded frame keeps it', () => {
    // A frame wide enough to hold a whole paraje cannot place every label at every
    // zoom. What a walker came for wins: the trip, then the track.
    const points = worldDocuments([track, trip], { language: 'es', translate })[0];
    const sortKeys = new Map(
      points?.collection.features.map((feature) => [
        feature.properties.experienceSlug,
        feature.properties.sortKey,
      ]),
    );
    expect(sortKeys.get(trip.slug)).toBe(0);
    expect(sortKeys.get(track.slug)).toBe(1);
  });

  it('drops a point whose coordinates are not finite', () => {
    const points = worldDocuments([{ ...track, latitude: Number.NaN }, trip], {
      language: 'es',
      translate,
    })[0];
    expect(points?.collection.features).toHaveLength(1);
    expect(points?.collection.features[0]?.properties.experienceSlug).toBe(trip.slug);
  });
});

describe('worldCameraBounds', () => {
  const region = { west: -64.83, south: -32.28, east: -64.66, north: -32.12 };

  it('opens on the region when there is nothing to draw', () => {
    expect(worldCameraBounds([], region)).toEqual(region);
    expect(worldCameraBounds([], null)).toBeNull();
  });

  it('widens a single point to the smallest readable span, grown by what it draws', () => {
    const bounds = worldCameraBounds([track], null);
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    // The minimum span is the floor, not the answer: the dot and the label beneath it
    // are drawn outside the anchor, so the box has to hold them too.
    expect(bounds.east - bounds.west).toBeGreaterThan(WORLD_MIN_SPAN_DEGREES);
    expect(bounds.north - bounds.south).toBeGreaterThan(WORLD_MIN_SPAN_DEGREES);
    expect((bounds.west + bounds.east) / 2).toBeCloseTo(track.longitude, 10);
  });

  it('grows the box past every point, with the most room under the southern one', () => {
    // The label sits *under* its point, so the south edge is where the frame loses
    // content: the last point of the world needs more room below it than above.
    const far: WorldExperience = { ...track, slug: 'far', latitude: -32.28, longitude: -64.8 };
    const bounds = worldCameraBounds([trip, far], null);
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    expect(bounds.west).toBeLessThan(far.longitude);
    expect(bounds.east).toBeGreaterThan(-64.736273);
    expect(bounds.north).toBeGreaterThan(trip.latitude);
    expect(bounds.south).toBeLessThan(far.latitude);
    expect(far.latitude - bounds.south).toBeGreaterThan(bounds.north - trip.latitude);
  });

  it('covers every point that is spread wider than the minimum, axis by axis', () => {
    // Wide on both axes: the box holds the points, plus the margins each axis needs.
    const far: WorldExperience = { ...track, slug: 'far', latitude: -32.28, longitude: -64.8 };
    const wide = worldCameraBounds([trip, far], null);
    expect(wide).not.toBeNull();
    if (!wide) return;
    expect(wide.west).toBeLessThan(far.longitude);
    expect(wide.south).toBeLessThan(far.latitude);
    // The trip's stops are drawn, so the box reaches their longitude, not the origin's.
    expect(wide.east).toBeGreaterThan(-64.736273);
    expect(wide.north).toBeGreaterThan(trip.latitude);

    // Wide on the longitude only: that axis is the points' own, the other one keeps
    // the minimum span around them.
    const sameLatitude: WorldExperience = {
      ...track,
      slug: 'far-east',
      latitude: trip.latitude,
      longitude: -64.8,
    };
    const flat = worldCameraBounds([trip, sameLatitude], null);
    expect(flat).not.toBeNull();
    if (!flat) return;
    expect(flat.west).toBeLessThan(-64.8);
    expect(flat.east).toBeGreaterThan(-64.736273);
    expect(flat.north - flat.south).toBeGreaterThan(WORLD_MIN_SPAN_DEGREES);
    // Centred on everything drawn — the origin and the stops — sideways, where the
    // margins are symmetric, and offset south only by the room the labels need.
    expect((flat.west + flat.east) / 2).toBeCloseTo((-64.8 + -64.736273) / 2, 10);
    const drawnLatitudes = [trip.latitude, ...(trip.waypoints ?? []).map((w) => w.latitude)];
    const centerLatitude = (Math.min(...drawnLatitudes) + Math.max(...drawnLatitudes)) / 2;
    expect((flat.south + flat.north) / 2).toBeLessThan(centerLatitude);
    expect(centerLatitude - (flat.south + flat.north) / 2).toBeLessThan(WORLD_MIN_SPAN_DEGREES / 2);
  });

  it('carries the movable labels of the world and of nothing else', () => {
    // Only the world's own points get labels that may move around their point: the
    // itinerary anchors opposite a reference on purpose, so moving them would put
    // the two back in the same pixels.
    expect(movableLabelsForDocument(WORLD_POINTS_DOCUMENT_KEY)).toBe(true);
    expect(movableLabelsForDocument(ITINERARY_DOCUMENT_KEY)).toBe(false);
    expect(movableLabelsForDocument('referencias')).toBe(false);
  });

  it("covers a trip's stops, not only its origin", () => {
    const bounds = worldCameraBounds([trip], null);
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    // The southernmost stop is below the origin, and it is drawn.
    expect(bounds.south).toBeLessThanOrEqual(-32.21333);
  });
});

describe('filterWorldExperiences', () => {
  it('keeps everything for the all chip and one format for the others', () => {
    expect(filterWorldExperiences([trip, track], null)).toHaveLength(2);
    expect(filterWorldExperiences([trip, track], 'trip')).toEqual([trip]);
    expect(filterWorldExperiences([trip, track], 'track')).toEqual([track]);
  });
});
