import { mapGlyphsKey, mapGlyphsPath, mapSpriteKey, mapSpritePath } from './artifacts';

/**
 * The glyph ranges and the sprite files a published style needs, and the bucket
 * keys and urls they live under.
 *
 * The map is drawn from our own bucket (`mapGlyphsPath`/`mapSpritePath`), and the
 * files behind those paths are Protomaps' own assets, so this module has two jobs:
 * read a style document and say exactly which files it will make a client request,
 * and say where those bytes come from (their pinned upstream revision) and where
 * they belong (our bucket layout).
 *
 * Everything here is pure: `scripts/map-assets.ts` and the mobile asset store both
 * derive their work from these functions instead of restating the layout.
 */

/** The parts of a style document these assets are derived from. */
export interface StyleAssets {
  /** MapLibre's glyphs url *template*: it substitutes `{fontstack}` and `{range}`. */
  glyphs?: unknown;
  /** The sprite *base*: MapLibre appends `.json`, `.png` and `@2x.png` to it. */
  sprite?: unknown;
  /** The layers, where every `text-font` the glyph ranges are planned for lives. */
  layers?: unknown;
}

/**
 * The Unicode ranges downloaded for every font stack a style names.
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

export type GlyphRange = (typeof GLYPH_RANGES)[number];

/**
 * The three files a sprite *base* stands for. MapLibre appends these suffixes
 * itself, so the base is a name, not a directory and not a filename: a base that
 * ended in `.png` would make the renderer ask for `light.png.png`.
 */
/**
 * The four files a sprite base stands for.
 *
 * MapLibre builds both the document and the image from the base, and for a `@2x`
 * device it asks for `@2x.json` **and** `@2x.png` — not the 1x document with a 2x
 * image. Shipping three left every high-density phone requesting a file that was
 * never uploaded, and the map drew without icons: a device log is what found it.
 */
export const SPRITE_SUFFIXES = ['.json', '.png', '@2x.json', '@2x.png'] as const;

export type SpriteSuffix = (typeof SPRITE_SUFFIXES)[number];

/**
 * The revision directory the upstream assets are pinned to.
 *
 * Not a range and not "latest": the sprite sheet names its own icons, so the sheet
 * and the style that draws them have to be the same revision or every icon is a
 * blank box. A new upstream revision is a deliberate edit here (and a re-run of
 * `make map-assets-fetch`), which is also why the fonts carry no version — a font
 * range is a font range.
 */
export const MAP_ASSET_SOURCE_VERSION = 'v4';

/** Where the upstream map assets are published. */
export const MAP_ASSET_SOURCE_ORIGIN = 'https://protomaps.github.io/basemaps-assets';

/** The upstream glyphs template, before the placeholders are filled. */
const SOURCE_GLYPHS_TEMPLATE = `${MAP_ASSET_SOURCE_ORIGIN}/fonts/{fontstack}/{range}.pbf`;

/** The upstream sprite base of the pinned revision. */
const SOURCE_SPRITE_BASE = `${MAP_ASSET_SOURCE_ORIGIN}/sprites/${MAP_ASSET_SOURCE_VERSION}/light`;

/**
 * The content type every uploaded object has to be served with, by extension.
 *
 * The upload targets in the Makefile carry the same three, and `verify` compares
 * the served type against this: a glyph range served as `text/html` is an error
 * page that MapLibre will try to parse as protobuf.
 */
export const MAP_ASSET_CONTENT_TYPES = {
  '.pbf': 'application/x-protobuf',
  '.json': 'application/json',
  '.png': 'image/png',
} as const;

/**
 * The content type one sprite suffix has to be served with, read from its extension.
 *
 * Comparing the whole suffix against `.json` looked right while there were three and
 * was wrong for `@2x.json`, which would have been uploaded as a `png`: a device would
 * then receive the sprite document with the wrong type. The extension is the fact that
 * decides, and an unknown one is a programming error rather than a guess.
 */
function spriteContentType(suffix: string): string {
  const dot = suffix.lastIndexOf('.');
  const extension = dot === -1 ? '' : suffix.slice(dot);
  const type = MAP_ASSET_CONTENT_TYPES[extension as keyof typeof MAP_ASSET_CONTENT_TYPES];
  if (!type) throw new Error(`no content type for the sprite suffix ${suffix}`);
  return type;
}

/** One file a style needs: where it belongs, where to get it, where it is served. */
export interface MapAssetRequest {
  /** Bucket key, and the path the file is written to under the assets directory. */
  key: string;
  /** The public url a client requests, i.e. where it has to end up serving. */
  url: string;
  /** Where the bytes are downloaded from: the pinned upstream revision. */
  downloadUrl: string;
  /** Content type the object has to be served with. */
  contentType: string;
}

/** What `assetKeysForStyle` may be told about the origin the urls point at. */
export interface MapAssetOrigin {
  /**
   * Origin to probe instead of the one the style names, e.g. production while
   * checking a style published for staging.
   */
  origin?: string;
}

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

/**
 * Every font stack the style's layers name, in the order the layers name them.
 *
 * `text-font` lives in `layout` for every symbol layer the style spec allows, which
 * is the only place a style can ask for a font.
 */
export function styleFontStacks(style: StyleAssets): string[] {
  const stacks = new Set<string>();
  const layers = style.layers;
  if (!Array.isArray(layers)) return [];

  for (const layer of layers) {
    if (layer === null || typeof layer !== 'object') continue;
    const layout = (layer as { layout?: unknown }).layout;
    if (layout === null || typeof layout !== 'object') continue;
    collectFontStacks((layout as Record<string, unknown>)['text-font'], stacks);
  }
  return [...stacks];
}

/** Fills the two placeholders of a glyph template without touching the encoding. */
function fillGlyphsTemplate(template: string, fontstack: string, range: string): string {
  return template.replace('{fontstack}', fontstack).replace('{range}', range);
}

/**
 * The url of one glyph file: the style's template with both placeholders filled.
 *
 * A font stack carries spaces (`Noto Sans Regular`): the filesystem and the bucket
 * keep the names as they are, but the request has to encode them, which is why the
 * whole filled url is passed through `encodeURI` and never the key.
 */
export function glyphsUrl(template: string, fontstack: string, range: string): string {
  return encodeURI(fillGlyphsTemplate(template, fontstack, range));
}

/** The url of one sprite file: the base with the suffix MapLibre appends. */
export function spriteUrl(base: string, suffix: SpriteSuffix): string {
  return `${base}${suffix}`;
}

/** The bucket key of one glyph file, in the layout the upload target walks. */
function glyphKey(fontstack: string, range: string): string {
  return fillGlyphsTemplate(mapGlyphsKey(), fontstack, range);
}

/** The bucket key of one sprite file, in the layout the upload target walks. */
function spriteKey(suffix: SpriteSuffix): string {
  return spriteUrl(mapSpriteKey(), suffix);
}

/**
 * An origin without its trailing slashes.
 *
 * Written as a scan rather than `replace(/\/+$/, '')` on purpose: that pattern is
 * quadratic on a long run of slashes that ends in something else, and the origin comes
 * from a command line argument, which is untrusted input for a tool that fetches urls.
 */
function withoutTrailingSlashes(origin: string): string {
  let end = origin.length;
  while (end > 0 && origin.charCodeAt(end - 1) === 0x2f /* / */) end -= 1;
  return origin.slice(0, end);
}

/** The glyphs template a request goes to, honouring an origin override. */
function publicGlyphsTemplate(style: StyleAssets, origin: string | undefined): string | null {
  if (typeof style.glyphs !== 'string' || style.glyphs.length === 0) return null;
  if (origin === undefined) return style.glyphs;
  return `${withoutTrailingSlashes(origin)}${mapGlyphsPath()}`;
}

/** The sprite base a request goes to, honouring an origin override. */
function publicSpriteBase(style: StyleAssets, origin: string | undefined): string | null {
  if (typeof style.sprite !== 'string' || style.sprite.length === 0) return null;
  if (origin === undefined) return style.sprite;
  return `${withoutTrailingSlashes(origin)}${mapSpritePath()}`;
}

/**
 * Every file a style makes a client request, with its bucket key, its public url
 * and the upstream url its bytes come from.
 *
 * Glyphs come first, in the order the layers name their stacks and the ranges are
 * declared; the three sprite files follow. A style that names no glyphs template
 * draws no labels at all, so it needs no glyph files and none are invented: the
 * same rule the mobile asset store applies to the plan.
 */
export function assetKeysForStyle(
  style: StyleAssets,
  options: MapAssetOrigin = {},
): MapAssetRequest[] {
  const requests: MapAssetRequest[] = [];

  const glyphsTemplate = publicGlyphsTemplate(style, options.origin);
  if (glyphsTemplate !== null) {
    for (const fontstack of styleFontStacks(style)) {
      for (const range of GLYPH_RANGES) {
        requests.push({
          key: glyphKey(fontstack, range),
          url: glyphsUrl(glyphsTemplate, fontstack, range),
          downloadUrl: glyphsUrl(SOURCE_GLYPHS_TEMPLATE, fontstack, range),
          contentType: MAP_ASSET_CONTENT_TYPES['.pbf'],
        });
      }
    }
  }

  const spriteBase = publicSpriteBase(style, options.origin);
  if (spriteBase !== null) {
    for (const suffix of SPRITE_SUFFIXES) {
      requests.push({
        key: spriteKey(suffix),
        url: spriteUrl(spriteBase, suffix),
        downloadUrl: spriteUrl(SOURCE_SPRITE_BASE, suffix),
        contentType: spriteContentType(suffix),
      });
    }
  }

  return requests;
}
