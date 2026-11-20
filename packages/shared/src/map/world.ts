import type { UserExperienceFormat } from '../experiences';
import type { SupportedLanguage } from '../enums';
import { formatPrice } from '../utils/format-price';
import type { GeoBounds } from './camera';
import type { MapDocument, MapReferenceFeature, MapReferenceText } from './document';
import { LABEL_WEST_FROM_FRAME_SHARE, LABEL_WEST_SIDE } from './style';
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
 * Which point's label is placed first when a crowded frame cannot place them all.
 *
 * The world opens on a frame wide enough to hold a whole paraje, and places inside one
 * hamlet land a few dozen pixels apart. A trip is the experience a walker plans a day
 * around and pays for; a track is one piece they listen to on the way. The trip wins.
 */
const WORLD_POINT_SORT_KEYS: Record<UserExperienceFormat, number> = {
  trip: 0,
  track: 1,
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

/**
 * Room the opening frame leaves around the points it draws, as a fraction of
 * {@link WORLD_MIN_SPAN_DEGREES}.
 *
 * A point is not a pixel: the dot has a radius, and the label hangs *under* the anchor.
 * A frame fitted to the anchors alone therefore puts the first and the last point of the
 * world exactly on the edges, where the dot is clipped in half and the southern label —
 * the one every trip carries — falls outside the card. The margins are ratios of the
 * span, not pixels, so they hold at any zoom and in either renderer.
 */
const WORLD_POINT_MARGIN_RATIO = 0.06;

/**
 * The side margins, which are wider than the top one on purpose.
 *
 * A movable label can be placed *beside* its point, and its width comes from the title, so
 * it is the one thing in the frame whose extent the fit cannot derive. Reserving only the
 * dot's own margin would let an edge point put a long label past the card's edge, where the
 * card's clipping cuts it. The label is capped at 8 em by the movable layer's
 * `text-max-width` and the sides get twice the point margin, which bounds the common case
 * instead of promising a containment that an unbounded title can always break.
 */
const WORLD_SIDE_MARGIN_RATIO = 0.12;

/**
 * The extra room the south edge needs, on top of the point margin.
 *
 * Labels are anchored `top`, which in a map style means the text hangs below its point:
 * the southernmost label is the only thing in the frame that grows outwards, and it grows
 * south. Slightly more than a two-line label at the label's own size.
 */
const WORLD_LABEL_MARGIN_RATIO = 0.12;

/**
 * The span a coincident point's marker is pushed away from its real place, in degrees.
 *
 * Two experiences published at the same GPS point draw two dots on the same pixels, and
 * a thumb cannot tell them apart. Each member of such a group is drawn on a fan around
 * the true place, each with a stem back to it. The radius is a constant of the frame the
 * hub opens on (`WORLD_MIN_SPAN_DEGREES` across a 400 dp card is about 4 m per pixel),
 * so this radius reads as roughly a dot-and-a-half of separation at that opening zoom
 * and grows apart as the walker zooms in.
 */
export const SPIDER_OFFSET_DEGREES = 0.0008;

/**
 * How far a coincident point's name sits from its pushed-out dot, in em.
 *
 * The fan already separated the dots, so each name is placed beside its own dot —
 * the same direction the dot was pushed — and nothing can collide with its sibling's
 * name, because the sibling was pushed the other way.
 */
export const SPIDER_LABEL_OFFSET_EM = 0.9;

/** Two places are the same place when they round to the same millionth of a degree. */
function coincidentKey(experience: WorldExperience): string {
  return `${Math.round(experience.latitude * 1e6)}:${Math.round(experience.longitude * 1e6)}`;
}

/**
 * The slugs whose published place carries more than one experience.
 *
 * The map draws a crowd on a fan around the true place, and the callers that speak to
 * the walker (the picker, the preview) name that fact with this set: the same grouping,
 * read once, so drawing and words can never disagree about what a crowd is.
 */
export function worldSharedPlaceSlugs(experiences: readonly WorldExperience[]): Set<string> {
  const crowds = new Map<string, string[]>();
  for (const experience of experiences) {
    if (!isFinitePoint(experience)) continue;
    const key = coincidentKey(experience);
    const members = crowds.get(key);
    if (members) members.push(experience.slug);
    else crowds.set(key, [experience.slug]);
  }
  const shared = new Set<string>();
  for (const members of crowds.values()) {
    if (members.length > 1) for (const slug of members) shared.add(slug);
  }
  return shared;
}

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
  /**
   * The colour each format is drawn in, when the caller has a palette of its own.
   *
   * The app already decides what a type looks like: a format has a name and a colour,
   * and the home's cards and the list rows are drawn with it. The world asks for that
   * same table instead of keeping a second opinion, and falls back to
   * {@link WORLD_POINT_COLORS} so a caller without a theme still gets a legible map.
   */
  colors?: Partial<Record<UserExperienceFormat, string>>;
  /**
   * The longitudes the camera is fitted to, when they are not the ones being drawn.
   *
   * A format filter can leave a single eastern experience on a map still framed to the
   * whole world: with only that one point to measure, the east edge of the frame would be
   * the point itself, it would count as the westmost one, and its name would grow east and
   * be clipped. The caller passes the unfiltered longitudes so the side keeps describing
   * the frame the walker is looking at, not the slice a filter left.
   */
  frameLongitudes?: readonly number[];
  /**
   * The colour of the labels, when the format colour cannot carry text.
   *
   * A format colour is a surface: the pastel that fills a card disappears as text over
   * a pale basemap, so the label is drawn in the ink the same design uses for text on
   * that surface.
   */
  labelColor?: string;
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
 * The whole label of one point: the experience's title, and nothing else.
 *
 * The map is a place, not a list: a title is what a walker needs to recognise the
 * point under their thumb, while the duration and the price are a decision they make
 * once the preview is open — where there is room to show both properly. Dropping them
 * also keeps the label short enough to survive the map's own collision rule
 * (`text-allow-overlap: false` drops a label it cannot place).
 */
export function worldPointLabel(experience: WorldExperience): string {
  return experience.title.trim();
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
  { language, colors, labelColor, frameLongitudes }: WorldDocumentsOptions,
): MapDocument[] {
  const drawable = experiences.filter(isFinitePoint);

  /**
   * How far into the frame a point must sit for its name to grow leftwards.
   *
   * A name grows away from its dot, and the style cannot tell where the card ends: a point
   * near the eastern edge whose name grows east is drawn past it and cut. The easternmost
   * experiences get the opposite side instead, which the renderer expresses as a second
   * label layer because MapLibre's anchor is a layer property, not a feature one.
   *
   * Four fifths of the way across, so only the point that is genuinely against the right
   * edge flips: at a narrower threshold the next one in would flip too, and a name growing
   * west from a dot in the middle of the card lands on its neighbours.
   */
  const frame = (
    frameLongitudes && frameLongitudes.length > 0
      ? frameLongitudes
      : drawable.map((experience) => experience.longitude)
  ).filter((longitude) => Number.isFinite(longitude));
  const westmost = Math.min(...frame);
  const span = Math.max(...frame) - westmost;

  /**
   * Experiences grouped by the place they publish, in draw order.
   *
   * A group with more than one member is a crowd: the same GPS point carrying two
   * experiences draws two dots on the same pixels, and no zoom separates them. Each
   * member of a crowd is drawn on a fan around the true place, with a stem back to it,
   * so both markers and both names are thumb-reachable.
   */
  const crowds = new Map<string, WorldExperience[]>();
  for (const experience of drawable) {
    const key = coincidentKey(experience);
    const members = crowds.get(key);
    if (members) members.push(experience);
    else crowds.set(key, [experience]);
  }

  const features: MapReferenceFeature[] = [];
  for (const members of crowds.values()) {
    const count = members.length;
    members.forEach((experience, index) => {
      const label: MapReferenceText = { [language]: worldPointLabel(experience) };
      const acrossFrame = span === 0 ? 0 : (experience.longitude - westmost) / span;
      const color = colors?.[experience.format] ?? WORLD_POINT_COLORS[experience.format];

      /**
       * Where this marker is drawn: the place itself, unless it is one member of a
       * crowd, and then a spoke of the fan. The fan starts pointing north and turns
       * once around, so two members end up on opposite sides of the true place.
       */
      let longitude = experience.longitude;
      let latitude = experience.latitude;
      let properties: MapReferenceFeature['properties'] = {
        label,
        color,
        ...(labelColor === undefined ? {} : { labelColor }),
        experienceSlug: experience.slug,
        sortKey: WORLD_POINT_SORT_KEYS[experience.format],
        ...(acrossFrame >= LABEL_WEST_FROM_FRAME_SHARE ? { labelSide: LABEL_WEST_SIDE } : {}),
      };

      if (count > 1 && index === 0) {
        // The true place itself, drawn once per crowd as a hollow ring: the stem
        // points at it, and it is the one marker that says "the place is here"
        // without a word. It carries no press: a ring is a fact, not a choice.
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [experience.longitude, experience.latitude],
          },
          properties: {
            color,
            sharedCenter: true,
          },
        });
      }

      if (count > 1) {
        const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);
        longitude += directionX * SPIDER_OFFSET_DEGREES;
        latitude += directionY * SPIDER_OFFSET_DEGREES;
        properties = {
          ...properties,
          // Screen y grows downwards and latitude upwards, so the name's offset
          // mirrors the dot's direction on the y axis.
          spiderLabelOffset: [
            directionX * SPIDER_LABEL_OFFSET_EM,
            -directionY * SPIDER_LABEL_OFFSET_EM,
          ],
        };
        // The stem tells the eye which name belongs to which place, and it is drawn
        // by the document's own line layer: a LineString in the same source, in the
        // point's colour, from the true place to the pushed-out marker.
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [experience.longitude, experience.latitude],
              [longitude, latitude],
            ],
          },
          properties: { color },
        });
      }

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties,
      });
    });
  }

  const paths = drawable
    .map(worldPathDocument)
    .filter((document): document is MapDocument => document !== null);

  return [
    {
      key: WORLD_POINTS_DOCUMENT_KEY,
      scope: 'experience',
      collection: { type: 'FeatureCollection', features },
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
  const contentWidth = Math.max(east - west, WORLD_MIN_SPAN_DEGREES);
  const contentHeight = Math.max(north - south, WORLD_MIN_SPAN_DEGREES);
  const sideMargin = contentWidth * WORLD_SIDE_MARGIN_RATIO;
  const northMargin = contentHeight * WORLD_POINT_MARGIN_RATIO;
  const southMargin = contentHeight * (WORLD_POINT_MARGIN_RATIO + WORLD_LABEL_MARGIN_RATIO);

  return {
    west: centerLongitude - contentWidth / 2 - sideMargin,
    east: centerLongitude + contentWidth / 2 + sideMargin,
    south: centerLatitude - contentHeight / 2 - southMargin,
    north: centerLatitude + contentHeight / 2 + northMargin,
  };
}

/**
 * Whether this document's labels may move around their point instead of vanishing.
 *
 * Only the world's own points ask for it, and they need it: the frame that holds every
 * published experience also puts the experiences of one hamlet a few dozen pixels apart,
 * where a fixed "below the point" anchor leaves one label standing and culls the rest.
 * Every other document keeps its fixed side on purpose — the itinerary anchors opposite a
 * reference that describes the same place, and a label free to move would meet it again.
 */
export function movableLabelsForDocument(documentKey: string): boolean {
  return documentKey === WORLD_POINTS_DOCUMENT_KEY;
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
