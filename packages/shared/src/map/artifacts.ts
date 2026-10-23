import { DEFAULT_MAP_REGION, type MapRegionKey } from './regions';

/**
 * Version of the published map artifacts used when the environment does not
 * name one.
 *
 * The urls are derived from this version, so the environment only decides which
 * version the bucket holds (`MAP_ARTIFACT_VERSION`); nothing is compiled into
 * the client as a floor.
 */
export const DEFAULT_MAP_ARTIFACT_VERSION = 'v1';

/** Public media prefix every artifact is served under. */
const PUBLIC_MEDIA_PREFIX = '/media/public/';

/** Bucket key of a region archive, the same key the upload targets write. */
export function mapArchiveKey(
  region: MapRegionKey = DEFAULT_MAP_REGION,
  version: string = DEFAULT_MAP_ARTIFACT_VERSION,
): string {
  return `tiles/${region}/${version}.pmtiles`;
}

/** Bucket key of the shared style document, the same key the upload targets write. */
export function mapStyleKey(version: string = DEFAULT_MAP_ARTIFACT_VERSION): string {
  return `styles/${version}.json`;
}

/** Public path of a region archive, the url the app receives. */
export function mapArchivePath(
  region: MapRegionKey = DEFAULT_MAP_REGION,
  version: string = DEFAULT_MAP_ARTIFACT_VERSION,
): string {
  return `${PUBLIC_MEDIA_PREFIX}${mapArchiveKey(region, version)}`;
}

/** Public path of the shared style document. */
export function mapStylePath(version: string = DEFAULT_MAP_ARTIFACT_VERSION): string {
  return `${PUBLIC_MEDIA_PREFIX}${mapStyleKey(version)}`;
}

// Glyphs and sprites are content shared by every published version — three font
// stacks and one icon sheet, the same bytes whatever `MAP_ARTIFACT_VERSION`
// names — so unlike the archives and the style they carry no version segment.

/**
 * Bucket key template of a font glyph range, the same layout the upload target
 * reads from `MAP_ASSETS_DIR`.
 *
 * `{fontstack}` and `{range}` are left in place on purpose: MapLibre substitutes
 * them from the style's `glyphs` url, so one template describes every range of
 * every font stack instead of enumerating them here.
 */
export function mapGlyphsKey(): string {
  return 'glyphs/{fontstack}/{range}.pbf';
}

/**
 * Bucket key of the sprite *base*, the same layout the upload target reads.
 *
 * The base is a name, not a file: MapLibre appends `.json`, `.png` and
 * `@2x.png` to it, so a base that ended in a filename would ask for
 * `sprite.json.json`.
 */
export function mapSpriteKey(): string {
  return 'sprites/light';
}

/**
 * Public path of the glyphs template, the url the style's `glyphs` field must
 * carry. The placeholders survive into the url because MapLibre fills them.
 */
export function mapGlyphsPath(): string {
  return `${PUBLIC_MEDIA_PREFIX}${mapGlyphsKey()}`;
}

/**
 * Public path of the sprite base, the url the style's `sprite` field must
 * carry. No extension: MapLibre derives the three files from this base.
 */
export function mapSpritePath(): string {
  return `${PUBLIC_MEDIA_PREFIX}${mapSpriteKey()}`;
}
