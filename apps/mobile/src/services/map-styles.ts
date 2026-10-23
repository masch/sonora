import { Directory, File, Paths } from 'expo-file-system';

import { logger } from '@/utils/logger';

/**
 * The map style document and the assets its labels and icons come from, on the device.
 *
 * The archive is only half a map. The style document is fetched raw and kept in a
 * module-scope memory map, and its `glyphs`/`sprite` urls point at our media bucket,
 * so a cold start with no network used to draw nothing at all — an archive with no
 * style is a blank canvas (L6). Keeping the document and the asset files on the
 * device is what R12 asks for: a cold start draws the map the walker last saw.
 *
 * The rules that decide which file a style lives in, which glyph ranges a style needs
 * and whether a document may be pointed at the disk are pure, like `map-archives.ts`;
 * the file I/O around them is thin and every failure is swallowed into a log line,
 * because none of this is worth losing the map over.
 */

/** The parts of a style document this module reads. */
export interface StyleAssets {
  /** MapLibre's glyphs url *template*: it substitutes `{fontstack}` and `{range}`. */
  glyphs?: unknown;
  /** The sprite *base*: MapLibre appends `.json`, `.png` and `@2x.png` to it. */
  sprite?: unknown;
  /** The layers, where every `text-font` the glyph ranges are planned for lives. */
  layers?: unknown;
}

/** A style document as this module reads it back: an object MapLibre can draw. */
export interface StyleDocument extends StyleAssets {
  /** The one field every style carries and MapLibre refuses to draw without. */
  version: number;
}

/** The files a style's assets were found in, relative to the style directory. */
export interface StyleAssetsOnDisk {
  /** `file://…/map-styles`, the directory the document and its assets live in. */
  baseUri: string;
  /** The paths, relative to `baseUri`, that really exist on the device. */
  present: ReadonlySet<string>;
}

/** One glyph file a style needs: a font stack and one Unicode range of it. */
export interface GlyphAsset {
  /** The stack as MapLibre writes it into the url: the `text-font` names, comma joined. */
  fontstack: string;
  /** A range as MapLibre writes it, e.g. `0-255`. */
  range: string;
  /** Where the file lives, relative to the style directory. */
  path: string;
}

/** What the style's labels need from the disk. */
export interface FontAssetPlan {
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

/** The version segment of a url the shared generator built: `…/<version>.json`. */
const URL_VERSION = /([^/]+)\.json(?:\?.*)?$/;

/** Scheme, host and port of an absolute url. */
const URL_ORIGIN = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)/i;

/**
 * The Unicode ranges downloaded for every font stack the style names.
 *
 * How this list was chosen, because a range list is a claim about the places the app
 * publishes: every region is Spanish-speaking Latin script, so `0-255` (Basic Latin +
 * Latin-1 Supplement) is where every accent of a name lives — `á é í ó ú ñ ü ¿ ¡` —
 * and `256-511` (Latin Extended-A/B) covers the names that come over from Portuguese
 * and other Latin-script neighbours. Two ranges per stack is the honest size of that
 * claim: a range outside the list (Cyrillic, CJK) is not shipped, so a label needing
 * one draws without its glyphs instead of the map failing, and widening the list is
 * the one-line change if a region ever publishes those characters.
 *
 * 256 codepoints per range is what MapLibre asks for: it derives the range from the
 * fontstack and the codepoint, so these two strings are the ones it would request.
 */
export const GLYPH_RANGES = ['0-255', '256-511'] as const;

/**
 * The three files a sprite *base* stands for. MapLibre appends these suffixes itself,
 * so the directory keeps the same layout the bucket publishes (T-E1) and one rewrite
 * describes them all.
 */
const SPRITE_ASSETS = [
  { suffix: '.json', path: 'sprite.json' },
  { suffix: '.png', path: 'sprite.png' },
  { suffix: '@2x.png', path: 'sprite@2x.png' },
] as const;

/** Every sprite path, in the order they are downloaded. */
export const SPRITE_PATHS: readonly string[] = SPRITE_ASSETS.map((asset) => asset.path);

/** The glyphs template handed to MapLibre once the files are on the device. */
const LOCAL_GLYPHS_TEMPLATE = `/${GLYPHS_DIRECTORY}/{fontstack}/{range}.pbf`;

/** The sprite base handed to MapLibre once the three files are on the device. */
const LOCAL_SPRITE_BASE = '/sprite';

/**
 * Operators that make an array an *expression* instead of a font stack.
 *
 * A `text-font` is either a stack (an array of font names) or an expression that
 * evaluates to one, and `['get', 'font']` must not be read as the stack "get, font":
 * the strings an operator takes are property names and literals, never font names, so
 * an operator array contributes only the stacks written inside its nested arrays.
 */
const EXPRESSION_OPERATORS: ReadonlySet<string> = new Set([
  'literal',
  'get',
  'has',
  'in',
  'match',
  'case',
  'coalesce',
  'step',
  'interpolate',
  'zoom',
  'let',
  'var',
  'concat',
  'format',
  'string',
  'to-string',
  'number',
  'boolean',
  'upcase',
  'downcase',
  'array',
  'any',
  'all',
  'not',
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  '+',
  '-',
  '*',
  '/',
  '%',
]);

/**
 * Fingerprint of a string, as 8 lowercase hex digits: FNV-1a over the whole value, so
 * it is stable across runs, devices and platforms. The same function `map-archives.ts`
 * uses, and repeated here rather than imported because the two stores are independent
 * and neither should be able to break the other's file names.
 */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The host a style came from.
 *
 * Staging, production, a CDN and a local wrangler can publish the same version and
 * their documents point at different origins, so the host is part of the file's
 * identity for the same reason it is for an archive. A url without an origin is
 * fingerprinted whole: the app never builds one, and a wrong-but-stable key only
 * costs one re-download.
 */
function originOf(url: string): string {
  return fingerprint(URL_ORIGIN.exec(url)?.[1] ?? url);
}

/**
 * The file one style url lives in: `<origin fingerprint>-<version>.json`, or null when
 * the url names no version at all.
 *
 * The version is the segment the shared generator puts before the extension, and a url
 * that does not end in one has no identity this module could reason about — it is
 * reported as absent instead of being given a key nobody can explain.
 */
export function styleFileName(styleUrl: string): string | null {
  const version = URL_VERSION.exec(styleUrl)?.[1];
  if (!version) return null;
  return `${originOf(styleUrl)}-${version}.json`;
}

/** The directory the style documents and their assets live in. */
function styleDirectory(): Directory {
  return new Directory(Paths.document, STYLE_DIRECTORY);
}

/**
 * Collects every font stack a `text-font` value names, in first-seen order.
 *
 * The value is walked rather than read because a style may write it three ways: a
 * plain stack (`['Noto Sans Regular']`), an expression that picks a stack by zoom or
 * by feature (`['step', ['zoom'], ['Noto Sans Regular'], 12, ['Noto Sans Medium']]`),
 * or a `literal` array. A bare string is accepted too — it is not what the spec asks
 * for, but a style that carries one still means the same font.
 */
function collectFontStacks(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    const stack = value.trim();
    if (stack) into.add(stack);
    return;
  }
  if (!Array.isArray(value) || value.length === 0) return;

  const operator = value[0];
  if (typeof operator === 'string' && EXPRESSION_OPERATORS.has(operator)) {
    // The operator's own strings are property names and literals, never font names, so
    // only the arrays nested inside the expression can be a stack: `['get', 'font']`
    // names the property `font`, and reading it as the stack "font" would download a
    // font that does not exist on every run.
    for (const member of value.slice(1)) {
      if (Array.isArray(member)) collectFontStacks(member, into);
    }
    return;
  }

  if (value.every((member) => typeof member === 'string')) {
    const stack = value
      .map((member) => (member as string).trim())
      .filter(Boolean)
      .join(',');
    if (stack) into.add(stack);
    return;
  }

  for (const member of value) collectFontStacks(member, into);
}

/** Every font stack the style's layers name, in the order the layers name them. */
function styleFontStacks(style: StyleAssets): string[] {
  const stacks = new Set<string>();
  const layers = (style as { layers?: unknown }).layers;
  if (!Array.isArray(layers)) return [];

  for (const layer of layers) {
    if (layer === null || typeof layer !== 'object') continue;
    // `text-font` lives in `layout` for every symbol layer the style spec allows.
    const layout = (layer as { layout?: unknown }).layout;
    if (layout === null || typeof layout !== 'object') continue;
    collectFontStacks((layout as Record<string, unknown>)['text-font'], stacks);
  }
  return [...stacks];
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

/**
 * Writes one style document to the device, atomically.
 *
 * A style is written once and read on every cold start, so a half-written document
 * would be drawn as a style: the bytes land in `<name>.part` and the publication is
 * one move onto the final name. A deterministic temporary name is safe here because a
 * run is the only writer of one style url (the page keeps a single transfer per url),
 * and a leftover from a killed run is overwritten by the next one instead of
 * accumulating.
 *
 * Never throws: a style that could not be persisted is a cold start that has to fetch
 * it, which is what the app did before this store existed.
 */
export async function persistStyle(styleUrl: string, document: unknown): Promise<boolean> {
  const name = styleFileName(styleUrl);
  if (!name) return false;

  let temporary: File | undefined;
  try {
    const directory = styleDirectory();
    directory.create({ idempotent: true, intermediates: true });
    const target = new File(directory, name);
    temporary = new File(directory, `${name}.part`);
    temporary.write(JSON.stringify(document));
    await temporary.move(target, { overwrite: true });
    return true;
  } catch (error) {
    logger.warn('map style could not be persisted', error);
    try {
      if (temporary?.exists) temporary.delete();
    } catch {
      // The write that failed is what the caller has to hear about; a cleanup that
      // fails itself may not replace it.
    }
    return false;
  }
}

/**
 * The style document the device kept for this url, or null when it kept none.
 *
 * Never throws, and never returns something the map cannot draw: a body without the
 * `version` MapLibre reads first is a document this store did not write (or one a
 * failed move left behind), and reporting it as absent is what lets the caller fall
 * back instead of handing the map a document that cannot render.
 */
export async function readPersistedStyle(styleUrl: string): Promise<StyleDocument | null> {
  const name = styleFileName(styleUrl);
  if (!name) return null;

  try {
    const file = new File(styleDirectory(), name);
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(await file.text());
    if (parsed === null || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<StyleDocument>;
    if (typeof candidate.version !== 'number') return null;
    return candidate as StyleDocument;
  } catch (error) {
    logger.warn('map style could not be read from the device', error);
    return null;
  }
}

/** The url a glyph file is downloaded from: the style's template, placeholders filled. */
function glyphFileUrl(template: string, asset: GlyphAsset): string {
  const filled = template.replace('{fontstack}', asset.fontstack).replace('{range}', asset.range);
  // A font stack carries spaces (`Noto Sans Regular`): the filesystem keeps the names
  // as they are, but the request has to encode them.
  return encodeURI(filled);
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
            url: `${spriteBase}${sprite.suffix}`,
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

/**
 * Keeps a drawable document and the assets it needs on the device.
 *
 * Called after a fetch that succeeded, where nothing may interrupt the draw: the
 * document is written first (that is what the next cold start needs most) and the
 * assets follow. Resolves even when everything failed.
 */
export async function cacheStyleOnDisk(styleUrl: string, document: unknown): Promise<void> {
  await persistStyle(styleUrl, document);
  await downloadStyleAssets(document as StyleAssets);
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
