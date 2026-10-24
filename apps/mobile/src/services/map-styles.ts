import { Directory, File, Paths } from 'expo-file-system';

import {
  GLYPH_RANGES,
  glyphsUrl,
  SPRITE_SUFFIXES,
  spriteUrl,
  styleFontStacks,
  type StyleAssets,
} from '@sonora/shared';

import { logger } from '@/utils/logger';

/**
 * The binary assets a map style's labels and icons come from, on the device.
 *
 * The native renderer has no protocol API (`@maplibre/maplibre-react-native` 11.5.0
 * exposes no `addProtocol`, L15), so the only way MapLibre can read a font range or a
 * sprite sheet without a network is a real path: the files stay on the device and the
 * style is handed `file://` urls (R12 — a cold start draws the map the walker last saw).
 * That is all this module is.
 *
 * The style **document** is deliberately not here. It is one document with one key rule,
 * cached by `ApiClient` on both platforms (`map-style-cache.ts`); writing it to the disk
 * as well would be a second copy of the same bytes with a second key and a second
 * failure mode, for no answer the client's cache does not already give.
 *
 * The rules that decide which glyph ranges a style needs and whether a document may be
 * pointed at the disk are pure, like `map-archives.ts`; the file I/O around them is thin
 * and every failure is swallowed into a log line, because none of this is worth losing
 * the map over.
 */

/** The files a style's assets were found in, relative to the style directory. */
interface StyleAssetsOnDisk {
  /** `file://…/map-styles`, the directory the asset files live in. */
  baseUri: string;
  /** The paths, relative to `baseUri`, that really exist on the device. */
  present: ReadonlySet<string>;
}

/** One glyph file a style needs: a font stack and one Unicode range of it. */
interface GlyphAsset {
  /** The stack as MapLibre writes it into the url: the `text-font` names, comma joined. */
  fontstack: string;
  /** A range as MapLibre writes it, e.g. `0-255`. */
  range: string;
  /** Where the file lives, relative to the style directory. */
  path: string;
}

/** What the style's labels need from the disk. */
interface FontAssetPlan {
  /** Every font stack the style names, in the order the layers name them. */
  fontstacks: string[];
  /** The Unicode ranges downloaded for every stack. */
  ranges: readonly string[];
  /** The files the ranges amount to, one per stack and range. */
  glyphs: GlyphAsset[];
  /** Every glyph path, in plan order: what has to be present before a rewrite. */
  paths: string[];
}

/** Subdirectory of the document directory: the cache may be reclaimed, this may not. */
const STYLE_DIRECTORY = 'map-styles';

/** Subdirectory of the style directory the font ranges live in. */
const GLYPHS_DIRECTORY = 'glyphs';

/**
 * The Unicode ranges and the sprite files, which are facts about the whole pipeline
 * rather than about this store: the bucket the upload publishes, the style the server
 * rewrites and these files all have to agree, so the definition lives in
 * `@sonora/shared` (`map/glyphs.ts`) and `scripts/map-assets.ts` reads the same one.
 * Re-exported here because they are this module's public vocabulary too.
 */
export { GLYPH_RANGES };
export type { StyleAssets };

/**
 * The three files a sprite *base* stands for. MapLibre appends these suffixes itself,
 * so the directory keeps the same layout the bucket publishes (T-E1) and one rewrite
 * describes them all. The names are the on-disk ones: a sprite base called `light`
 * in the bucket lands as `sprite{suffix}` next to the style, because MapLibre is
 * handed that base as a path.
 */
const SPRITE_ASSETS = SPRITE_SUFFIXES.map((suffix) => ({ suffix, path: `sprite${suffix}` }));

/** Every sprite path, in the order they are downloaded. */
export const SPRITE_PATHS: readonly string[] = SPRITE_ASSETS.map((asset) => asset.path);

/** The glyphs template handed to MapLibre once the files are on the device. */
const LOCAL_GLYPHS_TEMPLATE = `/${GLYPHS_DIRECTORY}/{fontstack}/{range}.pbf`;

/** The sprite base handed to MapLibre once the three files are on the device. */
const LOCAL_SPRITE_BASE = '/sprite';

/** The directory the style's asset files live in. */
function styleDirectory(): Directory {
  return new Directory(Paths.document, STYLE_DIRECTORY);
}

/**
 * The glyph files a style needs, and the ranges they are downloaded in.
 *
 * Pure, so "every `text-font` the style names has its ranges on disk" is a claim a
 * test can check without a device. A style with no `glyphs` url draws no labels at
 * all, so it needs no files and the plan is empty rather than pretending otherwise.
 */
export function planFontAssets(style: StyleAssets): FontAssetPlan {
  const fontstacks = styleFontStacks(style);
  const templated = typeof style.glyphs === 'string' && style.glyphs.length > 0;
  if (!templated || fontstacks.length === 0) {
    return { fontstacks, ranges: [], glyphs: [], paths: [] };
  }

  const glyphs: GlyphAsset[] = [];
  for (const fontstack of fontstacks) {
    for (const range of GLYPH_RANGES) {
      glyphs.push({
        fontstack,
        range,
        path: `${GLYPHS_DIRECTORY}/${fontstack}/${range}.pbf`,
      });
    }
  }

  return {
    fontstacks,
    ranges: GLYPH_RANGES,
    glyphs,
    paths: glyphs.map((asset) => asset.path),
  };
}

/**
 * The files that have to be on the device before either of the style's urls may be
 * rewritten, and which of the two urls a rewrite would touch.
 *
 * One helper for both sides of the rule — the existence check and the rewrite — so they
 * cannot disagree about what "every file" means. A style that names no font stack gets
 * no glyph rewrite: the only stack left would be the one our own reference labels use,
 * and a `file://` template with no file behind it would draw no labels at all, which is
 * worse than the network.
 */
function plannedAssets(style: StyleAssets): {
  rewriteGlyphs: boolean;
  rewriteSprite: boolean;
  paths: string[];
} {
  const plan = planFontAssets(style);
  const rewriteSprite = typeof style.sprite === 'string';
  return {
    rewriteGlyphs: plan.glyphs.length > 0,
    rewriteSprite,
    paths: [...plan.paths, ...(rewriteSprite ? SPRITE_PATHS : [])],
  };
}

/**
 * The style the map is handed, with its asset urls pointed at the device.
 *
 * All or nothing, on purpose: MapLibre reads the two urls itself, so a style that
 * points at a half-downloaded sheet would draw labels and lose every icon, with no
 * failure to see. When any file the style would request is missing, the style is
 * returned exactly as published and MapLibre fetches from the network the way it does
 * today — the map never gets worse than it already was.
 *
 * This is the T-E2 experiment (L15): `@maplibre/maplibre-react-native` 11.5.0 exposes
 * no `addProtocol`, but MapLibre Native's own resource loader does read `file://` (it
 * is how a `pmtiles://file://…` archive is read), so a `file://` glyphs template
 * either draws names offline or it does not. No test here can answer that: it costs
 * one device build in airplane mode, and the answer changes only whether the rewrite
 * stays.
 */
export function rewriteStyleAssetsToDisk<T extends StyleAssets>(
  style: T,
  files: StyleAssetsOnDisk,
): T {
  const planned = plannedAssets(style);
  // Nothing to rewrite, or nothing this device could serve: the published urls stand.
  if (planned.paths.length === 0 || planned.paths.some((path) => !files.present.has(path))) {
    return style;
  }

  return {
    ...style,
    ...(planned.rewriteGlyphs ? { glyphs: `${files.baseUri}${LOCAL_GLYPHS_TEMPLATE}` } : {}),
    ...(planned.rewriteSprite ? { sprite: `${files.baseUri}${LOCAL_SPRITE_BASE}` } : {}),
  } as T;
}

/** The url a glyph file is downloaded from: the style's template, placeholders filled. */
function glyphFileUrl(template: string, asset: GlyphAsset): string {
  // A font stack carries spaces (`Noto Sans Regular`): the filesystem keeps the names
  // as they are, but the request has to encode them, which `glyphsUrl` does.
  return glyphsUrl(template, asset.fontstack, asset.range);
}

/**
 * Downloads one asset unless it is already there, through a temporary of its own.
 *
 * The temporary matters for the same reason it does for an archive: on Android the
 * response streams into the destination, so a transfer that fails leaves a partial
 * file, and a partial file under the asset's own name would be "present" on every
 * later check and would let the rewrite point the map at a file it cannot read.
 *
 * Best effort by design: a font range or an icon sheet that could not be downloaded
 * leaves the published url in place, and the map draws exactly what it drew before.
 */
async function downloadAsset(directory: Directory, url: string, path: string): Promise<void> {
  const destination = new File(directory, path);
  const temporary = new File(directory, `${path}.part`);
  try {
    if (destination.exists) return;
    destination.parentDirectory.create({ idempotent: true, intermediates: true });
    await File.downloadFileAsync(url, temporary);
    await temporary.move(destination, { overwrite: true });
  } catch (error) {
    logger.warn('map style asset could not be downloaded', error);
    try {
      if (temporary.exists) temporary.delete();
    } catch {
      // Housekeeping in front of a fallback the map survives either way.
    }
  }
}

/**
 * Downloads the font ranges and the sprite files the style needs, next to it.
 *
 * Best effort and per file: every failure is logged and none of them is reported to
 * the caller, so an asset transfer can never take the map down.
 */
export async function downloadStyleAssets(style: StyleAssets): Promise<void> {
  const plan = planFontAssets(style);
  const glyphsTemplate = typeof style.glyphs === 'string' ? style.glyphs : undefined;
  const spriteBase = typeof style.sprite === 'string' ? style.sprite : undefined;
  if (!glyphsTemplate && !spriteBase) return;

  try {
    const directory = styleDirectory();
    directory.create({ idempotent: true, intermediates: true });

    // One at a time, as a chain rather than a loop: these transfers share one
    // connection with the map the walker is already looking at, and the sequence is
    // what the code says it does.
    const transfers = [
      ...(glyphsTemplate
        ? plan.glyphs.map((asset) => ({
            url: glyphFileUrl(glyphsTemplate, asset),
            path: asset.path,
          }))
        : []),
      ...(spriteBase
        ? SPRITE_ASSETS.map((sprite) => ({
            url: spriteUrl(spriteBase, sprite.suffix),
            path: sprite.path,
          }))
        : []),
    ];

    await transfers.reduce(
      (previous, transfer) =>
        previous.then(() => downloadAsset(directory, transfer.url, transfer.path)),
      Promise.resolve(),
    );
  } catch (error) {
    logger.warn('map style assets could not be downloaded', error);
  }
}

/** The style's asset paths that really exist on the device, relative to its directory. */
async function assetsOnDisk(style: StyleAssets): Promise<Set<string>> {
  const { paths } = plannedAssets(style);

  const directory = styleDirectory();
  const present = new Set<string>();
  for (const path of paths) {
    if (new File(directory, path).exists) present.add(path);
  }
  return present;
}

/**
 * The style with its `glyphs`/`sprite` pointed at the files this device really holds.
 *
 * The existence check is done here, not in a render: the answer is a fact about the
 * filesystem and the map is handed the result once. A style whose assets are all
 * present keeps its `file://` urls for the rest of the page; a style missing any of
 * them is returned untouched and MapLibre goes to the network.
 */
export async function localizeStyle<T extends StyleAssets>(style: T): Promise<T> {
  try {
    const present = await assetsOnDisk(style);
    return rewriteStyleAssetsToDisk(style, { baseUri: styleDirectory().uri, present });
  } catch (error) {
    logger.warn('map style assets could not be read from the device', error);
    return style;
  }
}
