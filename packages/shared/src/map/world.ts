import type { UserExperienceFormat } from '../experiences';
import type { SupportedLanguage } from '../enums';
import { formatPrice } from '../utils/format-price';
import type { GeoBounds } from './camera';
import type { MapDocument, MapReferenceFeature, MapReferenceText } from './document';
import type { TranslateKey } from './labels';

/**
 * The world's own documents: one point per published experience, and the path of
 * every trip, derived from the experiences payload on the client.
 *
 * Derived rather than stored, on purpose. A seeded global document would be a
 * second copy of `experiences` — the drift it would accumulate is the whole
 * reason the points come from the same payload the lists and the detail screen
 * already read. Nothing here is written anywhere: the documents live for the
 * render that drew them.
 */

/** Stable key of the document that draws one point per experience. */
export const WORLD_POINTS_DOCUMENT_KEY = 'world-experiences';

/** Prefix of the document that draws one trip's own path. */
export const WORLD_PATH_PREFIX = 'world-path-';

/**
 * The colour a point is drawn in, by format. The label already carries the title,
 * the duration and the price, so the format is what colour is left to say.
 */
export const WORLD_POINT_COLORS: Record<UserExperienceFormat, string> = {
  trip: '#065f46',
  track: '#b45309',
};

/**
 * The smallest span the camera opens on, in degrees (~1.7 km of latitude).
 *
 * Published experiences sit a few hundred metres apart, so fitting their own box
 * would open on a couple of hundred metres and the three points would land on the
 * same pixels. The place has to read as a place; "all of Umepay" is what panning
 * reaches, not what one frame can hold at a legible scale.
 */
export const WORLD_MIN_SPAN_DEGREES = 0.015;

/** The fields of a published experience the world draws, and nothing else. */
export interface WorldExperience {
  slug: string;
  title: string;
  format: UserExperienceFormat;
  latitude: number;
  longitude: number;
  durationSeconds: number;
  free: boolean;
  price?: number | null;
  currency?: string | null;
  /** A trip's stops; absent for a track, which is a single origin. */
  waypoints?: readonly { latitude: number; longitude: number }[];
}

export interface WorldDocumentsOptions {
  /** The language the labels are authored in — the one the app is showing. */
  language: SupportedLanguage;
  translate: TranslateKey;
}

function isFinitePoint(experience: WorldExperience): boolean {
  return Number.isFinite(experience.latitude) && Number.isFinite(experience.longitude);
}

/**
 * The duration as the app says it: minutes from a minute up, seconds below it.
 *
 * A duration nobody can read — absent, zero, negative — contributes nothing
 * instead of drawing `0 min`, so a broken seed loses one part of the label and
 * keeps the title.
 */
export function worldDurationLabel(seconds: number, translate: TranslateKey): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return translate('map.world.labelSeconds', { seconds: Math.round(seconds) });
  return translate('map.world.labelDuration', { minutes: Math.round(seconds / 60) });
}

/**
 * What the point costs: the word for a free experience, the formatted price
 * otherwise, and nothing when the payload carries no price at all.
 */
export function worldPriceLabel(experience: WorldExperience, translate: TranslateKey): string {
  if (experience.free) return translate('map.world.free');
  if (experience.price === null || experience.price === undefined) return '';
  return formatPrice(experience.price, experience.currency ?? 'ARS');
}

/**
 * The whole label of one point, on one line: `{title} · {duration} · {price}`.
 *
 * One line because the map drops a label it cannot place without overlapping
 * another one (`text-allow-overlap: false` in the shared style builder), so a
 * second line would only make more of them lose. Parts that have no value are
 * left out instead of leaving an empty segment.
 */
export function worldPointLabel(experience: WorldExperience, translate: TranslateKey): string {
  return [
    experience.title.trim(),
    worldDurationLabel(experience.durationSeconds, translate),
    worldPriceLabel(experience, translate),
  ]
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** The path one trip draws, or `null` when it has no stops to join. */
function worldPathDocument(experience: WorldExperience): MapDocument | null {
  if (experience.format !== 'trip') return null;

  const waypoints = (experience.waypoints ?? []).filter(
    (waypoint) => Number.isFinite(waypoint.latitude) && Number.isFinite(waypoint.longitude),
  );
  // A line needs two positions: a bare origin has no path to draw.
  if (waypoints.length === 0 || !isFinitePoint(experience)) return null;

  return {
    key: `${WORLD_PATH_PREFIX}${experience.slug}`,
    scope: 'experience',
    // Under the points: the path says where the trip goes, the point is the target.
    zIndex: -1,
    collection: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [experience.longitude, experience.latitude],
              ...waypoints.map(
                (waypoint) => [waypoint.longitude, waypoint.latitude] as [number, number],
              ),
            ],
          },
          properties: {},
        },
      ],
    },
  };
}

/**
 * Everything the world draws: the points document, then one path document per trip.
 *
 * Order is draw order and it is stable, because on native a document set that
 * changes rebuilds the style: the points come first and the paths precede them in
 * z-order, so a point is never hidden under a line.
 *
 * `experienceSlug` rides in the feature's properties so the tap can name the
 * experience without parsing the label: the map reports the reference it was
 * pressed on, and that property is the one thing that survives the trip.
 */
export function worldDocuments(
  experiences: readonly WorldExperience[],
  { language, translate }: WorldDocumentsOptions,
): MapDocument[] {
  const drawable = experiences.filter(isFinitePoint);

  const points = drawable.map((experience): MapReferenceFeature => {
    const label: MapReferenceText = { [language]: worldPointLabel(experience, translate) };
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [experience.longitude, experience.latitude] },
      properties: {
        label,
        color: WORLD_POINT_COLORS[experience.format],
        experienceSlug: experience.slug,
      },
    };
  });

  const paths = drawable
    .map(worldPathDocument)
    .filter((document): document is MapDocument => document !== null);

  return [
    {
      key: WORLD_POINTS_DOCUMENT_KEY,
      scope: 'experience',
      collection: { type: 'FeatureCollection', features: points },
    },
    ...paths,
  ];
}

/**
 * The box the camera opens on: the experiences' own, widened to
 * {@link WORLD_MIN_SPAN_DEGREES}, and the region's when there is nothing to draw.
 *
 * A world with no points is not an error — an environment whose seeds are all
 * unpublished still has a place — so the region box stands in, and a world with
 * neither resolves `null` and the renderer falls back to its own centre.
 */
export function worldCameraBounds(
  experiences: readonly WorldExperience[],
  regionBounds: GeoBounds | null,
): GeoBounds | null {
  /** Every position the world draws: the origin of each experience, plus a trip's stops. */
  const positions: { latitude: number; longitude: number }[] = [];
  for (const experience of experiences) {
    if (isFinitePoint(experience)) positions.push(experience);
    for (const waypoint of experience.waypoints ?? []) {
      if (Number.isFinite(waypoint.latitude) && Number.isFinite(waypoint.longitude)) {
        positions.push(waypoint);
      }
    }
  }
  if (positions.length === 0) return regionBounds;

  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const position of positions) {
    west = Math.min(west, position.longitude);
    east = Math.max(east, position.longitude);
    south = Math.min(south, position.latitude);
    north = Math.max(north, position.latitude);
  }

  const centerLongitude = (west + east) / 2;
  const centerLatitude = (south + north) / 2;
  // Each axis takes its own minimum: a box widened to the larger span would throw
  // away the frame's width on a world whose points are far apart north to south,
  // and the camera's own aspect fit already decides what the box becomes on screen.
  const halfWidth = Math.max(east - west, WORLD_MIN_SPAN_DEGREES) / 2;
  const halfHeight = Math.max(north - south, WORLD_MIN_SPAN_DEGREES) / 2;

  return {
    west: centerLongitude - halfWidth,
    east: centerLongitude + halfWidth,
    south: centerLatitude - halfHeight,
    north: centerLatitude + halfHeight,
  };
}

/**
 * The experiences the chips leave on screen.
 *
 * `null` is the "everything" chip, and it is not the same value as an empty list:
 * a world filtered down to nothing says so, while a world with nothing to filter
 * is a place with no published experiences yet.
 */
export function filterWorldExperiences<T extends WorldExperience>(
  experiences: readonly T[],
  format: UserExperienceFormat | null,
): T[] {
  if (format === null) return [...experiences];
  return experiences.filter((experience) => experience.format === format);
}
