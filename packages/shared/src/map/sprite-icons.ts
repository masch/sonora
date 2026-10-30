/**
 * The icon names the published sprite sheet carries, which is the contract the style is
 * checked against.
 *
 * Why this list exists: the `pois` layer's `icon-image` is `["get","kind"]` with a single
 * exception, so a kind without an icon is not drawn as a blank square — it is not drawn at
 * all. That is how every hotel, guest house and cabin in Calamuchita stayed invisible while
 * the data sat in the tiles: the kind was in the filter and the sheet had no glyph for it.
 * Nothing in the style said so, and no test compared the two.
 *
 * The sheet is one published file, `sprites/light{,@2x}.{json,png}`, made of Protomaps'
 * pinned upstream atlas plus the icons this repository draws itself. So the names come from
 * two places, and both are listed here: the upstream snapshot below, and `OUR_SPRITE_ICONS`,
 * which `scripts/map-sprites/icons.ts` renders.
 */

/**
 * The 53 icon names of the pinned Protomaps light sheet.
 *
 * This is a snapshot, not a copy of a file we own: the honest source of truth is the pinned
 * upstream revision (`MAP_ASSET_SOURCE_VERSION` in `./glyphs.ts`, currently `v4`), whose
 * sprite document the publish pipeline fetches into the gitignored `map-assets/sprites/`
 * directory. A dependency on that directory would make this module unreadable on a clean
 * checkout and on CI, so the names are hardcoded here and a mismatch is caught by the
 * publish side, where the real sheet is in hand.
 *
 * Sorted by code unit, so the order is stable and a review diff shows one added name.
 */
export const UPSTREAM_SPRITE_ICONS = [
  'NL:S-road-1char',
  'NL:S-road-2char',
  'NL:S-road-3char',
  'NL:S-road-4char',
  'NL:S-road-5char',
  'US:I-1char',
  'US:I-2char',
  'US:I-3char',
  'US:I-4char',
  'US:I-5char',
  'aerodrome',
  'animal',
  'arrow',
  'artwork',
  'attraction',
  'bar',
  'beach',
  'beauty',
  'bench',
  'books',
  'building',
  'bus_stop',
  'cafe',
  'capital',
  'clothes',
  'convenience',
  'drinking_water',
  'electronics',
  'fast_food',
  'ferry_terminal',
  'forest',
  'garden',
  'generic_shield-1char',
  'generic_shield-2char',
  'generic_shield-3char',
  'generic_shield-4char',
  'generic_shield-5char',
  'library',
  'marina',
  'museum',
  'park',
  'peak',
  'post_office',
  'restaurant',
  'school',
  'stadium',
  'supermarket',
  'theatre',
  'toilets',
  'townspot',
  'train_station',
  'university',
  'zoo',
] as const;

/**
 * The icons this repository adds to the sheet: a bed for the lodging kinds and a tent for
 * the camping ones.
 *
 * `scripts/map-sprites/icons.ts` draws these, and a test asserts the two lists are equal, so
 * the shared name list cannot claim an icon nothing draws.
 */
export const OUR_SPRITE_ICONS = ['lodging', 'camping'] as const;

/** Every icon name the published sheet carries. */
export type SpriteIconName =
  (typeof UPSTREAM_SPRITE_ICONS)[number] | (typeof OUR_SPRITE_ICONS)[number];

/**
 * The names of every icon a style may ask for without drawing nothing.
 *
 * Upstream order first, then ours, deduplicated: the order is what the sheet is built in, and
 * a name we both carry stays where upstream put it. Ours are appended rather than sorted in so
 * that a name collision with upstream is visible in the result instead of hidden by a sort.
 */
export function spriteIconNames(): SpriteIconName[] {
  return [...new Set<SpriteIconName>([...UPSTREAM_SPRITE_ICONS, ...OUR_SPRITE_ICONS])];
}
