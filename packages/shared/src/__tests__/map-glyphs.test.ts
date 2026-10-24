import { describe, expect, it } from 'vitest';

import {
  assetKeysForStyle,
  GLYPH_RANGES,
  glyphsUrl,
  MAP_ASSET_SOURCE_ORIGIN,
  MAP_ASSET_SOURCE_VERSION,
  SPRITE_SUFFIXES,
  spriteUrl,
  styleFontStacks,
  type StyleAssets,
} from '../map/glyphs';

const API_ORIGIN = 'https://sonora-api-staging.sonora-api.workers.dev';

/** The glyphs template the published style carries, as the API rewrites it. */
const REMOTE_GLYPHS = `${API_ORIGIN}/media/public/glyphs/{fontstack}/{range}.pbf`;
/** The sprite base the published style carries. */
const REMOTE_SPRITE = `${API_ORIGIN}/media/public/sprites/light`;

/**
 * The published style document, reduced to the parts the assets come from: three
 * font stacks named three ways (a plain stack, a `step` expression and a `case`
 * whose branches are `literal` arrays), one expression that reads the stack from
 * the feature, and the sprite some layers draw icons from.
 */
function publishedStyle(): StyleAssets {
  return {
    glyphs: REMOTE_GLYPHS,
    sprite: REMOTE_SPRITE,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
      {
        id: 'places',
        type: 'symbol',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'] },
      },
      {
        id: 'roads',
        type: 'symbol',
        layout: {
          'text-field': ['get', 'name'],
          // The zoom-dependent stack: Medium past z12, Regular below it.
          'text-font': ['step', ['zoom'], ['Noto Sans Regular'], 12, ['Noto Sans Medium']],
        },
      },
      {
        id: 'water',
        type: 'symbol',
        layout: { 'text-font': ['literal', ['Noto Sans Italic']] },
      },
      // A `case` whose branches are `literal` stacks, the shape the published
      // `places_locality` layer really uses.
      {
        id: 'localities',
        type: 'symbol',
        layout: {
          'text-font': [
            'case',
            ['<=', ['get', 'min_zoom'], 5],
            ['literal', ['Noto Sans Medium']],
            ['literal', ['Noto Sans Regular']],
          ],
        },
      },
      // An expression that reads the stack from the feature: no font name to plan.
      { id: 'shields', type: 'symbol', layout: { 'text-font': ['get', 'font'] } },
      { id: 'station', type: 'symbol', layout: { 'icon-image': 'station' } },
    ],
  };
}

describe('styleFontStacks', () => {
  it('reads every stack the published document names, in the order the layers name them', () => {
    // A plain stack, both branches of a zoom expression and a `literal` inside a
    // `case` — and nothing from `['get', 'font']`, whose strings are a property
    // path, not font names.
    expect(styleFontStacks(publishedStyle())).toEqual([
      'Noto Sans Regular',
      'Noto Sans Medium',
      'Noto Sans Italic',
    ]);
  });

  it('never reads an expression operator as a font name', () => {
    // `['get', 'font']` asks for a property called `font`. Reading it as the stack
    // "font" would download a font stack that does not exist on every run.
    const stacks = styleFontStacks({
      glyphs: REMOTE_GLYPHS,
      layers: [
        { layout: { 'text-font': ['get', 'font'] } },
        { layout: { 'text-font': ['coalesce', ['get', 'font'], ['literal', ['Noto Sans Bold']]] } },
      ],
    });

    expect(stacks).toEqual(['Noto Sans Bold']);
    for (const operator of ['get', 'literal', 'step', 'match', 'coalesce', 'case', 'zoom']) {
      expect(stacks).not.toContain(operator);
    }
  });

  it('joins a multi-name stack the way MapLibre writes it into the url', () => {
    // MapLibre joins the names of one stack with a comma, so that is also the
    // directory name the files are published under.
    expect(
      styleFontStacks({
        layers: [{ layout: { 'text-font': ['Noto Sans Regular', 'Noto Sans Bold'] } }],
      }),
    ).toEqual(['Noto Sans Regular,Noto Sans Bold']);
  });

  it('finds nothing in a style that names no stack', () => {
    expect(styleFontStacks({})).toEqual([]);
    expect(styleFontStacks({ glyphs: REMOTE_GLYPHS })).toEqual([]);
    expect(styleFontStacks({ layers: [{ id: 'background' }, null, 'not a layer'] })).toEqual([]);
  });
});

describe('glyphsUrl', () => {
  it('fills both placeholders and encodes the spaces of a stack name', () => {
    expect(glyphsUrl(REMOTE_GLYPHS, 'Noto Sans Regular', '0-255')).toBe(
      `${API_ORIGIN}/media/public/glyphs/Noto%20Sans%20Regular/0-255.pbf`,
    );
    expect(glyphsUrl(REMOTE_GLYPHS, 'Noto Sans Italic', '256-511')).toBe(
      `${API_ORIGIN}/media/public/glyphs/Noto%20Sans%20Italic/256-511.pbf`,
    );
  });

  it('leaves a placeholder the template does not carry alone', () => {
    expect(
      glyphsUrl(`${API_ORIGIN}/glyphs/{fontstack}/0-255.pbf`, 'Noto Sans Regular', '9-9'),
    ).toBe(`${API_ORIGIN}/glyphs/Noto%20Sans%20Regular/0-255.pbf`);
  });
});

describe('spriteUrl', () => {
  it('appends each of the three suffixes MapLibre derives from a sprite base', () => {
    // The style publishes a base, not a directory: MapLibre asks for these three
    // files itself, so they are the three that have to be in the bucket.
    expect(SPRITE_SUFFIXES.map((suffix) => spriteUrl(REMOTE_SPRITE, suffix))).toEqual([
      `${REMOTE_SPRITE}.json`,
      `${REMOTE_SPRITE}.png`,
      `${REMOTE_SPRITE}@2x.png`,
    ]);
  });
});

describe('assetKeysForStyle', () => {
  it('names the nine files the published style makes a client request', () => {
    const requests = assetKeysForStyle(publishedStyle());

    expect(requests.map((request) => request.key)).toEqual([
      'glyphs/Noto Sans Regular/0-255.pbf',
      'glyphs/Noto Sans Regular/256-511.pbf',
      'glyphs/Noto Sans Medium/0-255.pbf',
      'glyphs/Noto Sans Medium/256-511.pbf',
      'glyphs/Noto Sans Italic/0-255.pbf',
      'glyphs/Noto Sans Italic/256-511.pbf',
      'sprites/light.json',
      'sprites/light.png',
      'sprites/light@2x.png',
    ]);
    // Three stacks × two ranges, plus the three files of the sprite base.
    expect(requests).toHaveLength(3 * GLYPH_RANGES.length + SPRITE_SUFFIXES.length);
  });

  it('keeps the bucket key as the directory names are and encodes only the url', () => {
    // The key is the layout the upload target walks and the object key R2 stores;
    // the names carry the space. Only the request url encodes it.
    const [first] = assetKeysForStyle(publishedStyle());

    expect(first.key).toBe('glyphs/Noto Sans Regular/0-255.pbf');
    expect(first.url).toBe(`${API_ORIGIN}/media/public/glyphs/Noto%20Sans%20Regular/0-255.pbf`);
  });

  it('keeps the placeholders filled, never templated', () => {
    for (const request of assetKeysForStyle(publishedStyle())) {
      expect(request.key).not.toContain('{');
      expect(request.url).not.toContain('{');
    }
  });

  it('downloads from the pinned Protomaps revision, not from the bucket being filled', () => {
    // The bucket is empty — that is why the tool exists — so the bytes come from
    // the upstream assets, pinned by their version directory.
    const requests = assetKeysForStyle(publishedStyle());

    expect(requests[0].downloadUrl).toBe(
      `${MAP_ASSET_SOURCE_ORIGIN}/fonts/Noto%20Sans%20Regular/0-255.pbf`,
    );
    expect(requests[6].downloadUrl).toBe(
      `${MAP_ASSET_SOURCE_ORIGIN}/sprites/${MAP_ASSET_SOURCE_VERSION}/light.json`,
    );
    expect(requests[8].downloadUrl).toBe(
      `${MAP_ASSET_SOURCE_ORIGIN}/sprites/${MAP_ASSET_SOURCE_VERSION}/light@2x.png`,
    );
  });

  it('targets the origin it is given instead of the one the style names', () => {
    // `verify --origin` probes production with the same style: the keys do not
    // move, only the origin the request goes to.
    const production = assetKeysForStyle(publishedStyle(), {
      origin: 'https://sonora-api.sonora-api.workers.dev/',
    });

    expect(production[0].url).toBe(
      'https://sonora-api.sonora-api.workers.dev/media/public/glyphs/Noto%20Sans%20Regular/0-255.pbf',
    );
    expect(production[8].url).toBe(
      'https://sonora-api.sonora-api.workers.dev/media/public/sprites/light@2x.png',
    );
    expect(production.map((request) => request.key)).toEqual(
      assetKeysForStyle(publishedStyle()).map((request) => request.key),
    );
  });

  it('carries the content type each object has to be served with', () => {
    const requests = assetKeysForStyle(publishedStyle());
    const typeOf = (key: string) => requests.find((request) => request.key === key)?.contentType;

    expect(typeOf('glyphs/Noto Sans Regular/0-255.pbf')).toBe('application/x-protobuf');
    expect(typeOf('sprites/light.json')).toBe('application/json');
    expect(typeOf('sprites/light.png')).toBe('image/png');
    expect(typeOf('sprites/light@2x.png')).toBe('image/png');
  });

  it('names no file when the style has neither a glyphs template nor a sprite', () => {
    expect(assetKeysForStyle({ layers: publishedStyle().layers })).toEqual([]);
  });

  it('names the sprite alone when the style has no glyphs template', () => {
    // A style with no `glyphs` draws no labels at all, so there is nothing to
    // download for them and the plan says so instead of inventing files.
    const requests = assetKeysForStyle({ sprite: REMOTE_SPRITE, layers: publishedStyle().layers });

    expect(requests.map((request) => request.key)).toEqual([
      'sprites/light.json',
      'sprites/light.png',
      'sprites/light@2x.png',
    ]);
  });

  it('names no glyph file when the style names no font stack', () => {
    const requests = assetKeysForStyle({
      glyphs: REMOTE_GLYPHS,
      sprite: REMOTE_SPRITE,
      layers: [{ id: 'background', type: 'background' }],
    });

    expect(requests.map((request) => request.key)).toEqual([
      'sprites/light.json',
      'sprites/light.png',
      'sprites/light@2x.png',
    ]);
  });
});
