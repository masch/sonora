import { describe, expect, it } from 'vitest';

import {
  mapArchiveKey,
  mapArchivePath,
  mapGlyphsKey,
  mapGlyphsPath,
  mapSpriteKey,
  mapSpritePath,
  mapStyleKey,
  mapStylePath,
} from '../map/artifacts';

describe('map artifact paths', () => {
  it('builds the archive path of a region, defaulting to the compiled region and version', () => {
    expect(mapArchivePath()).toBe('/media/public/tiles/calamuchita/v1.pmtiles');
    expect(mapArchivePath('calamuchita', 'v7')).toBe('/media/public/tiles/calamuchita/v7.pmtiles');
  });

  it('builds the style path, defaulting to the compiled version', () => {
    expect(mapStylePath()).toBe('/media/public/styles/v1.json');
    expect(mapStylePath('v7')).toBe('/media/public/styles/v7.json');
  });
});

describe('map artifact bucket keys', () => {
  it('builds the key the upload writes and the head reads', () => {
    // The path the client receives and the key the bucket stores differ only by
    // the public media prefix, so the head at /config time cannot drift from the
    // url it publishes.
    expect(mapArchiveKey()).toBe('tiles/calamuchita/v1.pmtiles');
    expect(mapArchiveKey('calamuchita', 'v7')).toBe('tiles/calamuchita/v7.pmtiles');
    expect(mapStyleKey()).toBe('styles/v1.json');
    expect(mapStyleKey('v7')).toBe('styles/v7.json');

    expect(mapArchivePath('calamuchita', 'v7')).toContain(mapArchiveKey('calamuchita', 'v7'));
    expect(mapStylePath('v7')).toContain(mapStyleKey('v7'));
  });
});

describe('self-hosted map assets', () => {
  it('keeps both placeholders in the glyphs template so MapLibre can fill them', () => {
    // One template serves every font stack and every range: MapLibre substitutes
    // `{fontstack}` and `{range}` itself, so neither may be resolved here.
    expect(mapGlyphsKey()).toBe('glyphs/{fontstack}/{range}.pbf');
    expect(mapGlyphsPath()).toBe('/media/public/glyphs/{fontstack}/{range}.pbf');
    expect(mapGlyphsPath()).toContain('{fontstack}');
    expect(mapGlyphsPath()).toContain('{range}');
  });

  it('exposes the sprite as a base with no extension', () => {
    // MapLibre appends `.json`, `.png` and `@2x.png` to the sprite url, so a base
    // ending in a filename would ask the bucket for `sprite.json.json`.
    expect(mapSpriteKey()).toBe('sprites/light');
    expect(mapSpritePath()).toBe('/media/public/sprites/light');
    expect(mapSpritePath()).not.toMatch(/\.(json|png)$/);
  });

  it('carries no version segment: the fonts and the sprite are shared content', () => {
    // Unlike the archives and the style, these are not per-artifact builds, so a
    // version in the path would duplicate ~1 MB per release for no new bytes.
    expect(mapGlyphsKey()).not.toMatch(/\/v\d+/);
    expect(mapSpriteKey()).not.toMatch(/\/v\d+/);
  });

  it('places both under the same public media prefix as the other artifacts', () => {
    expect(mapGlyphsPath()).toContain(mapGlyphsKey());
    expect(mapSpritePath()).toContain(mapSpriteKey());
    for (const path of [mapGlyphsPath(), mapSpritePath()]) {
      expect(path.startsWith('/media/public/')).toBe(true);
    }
  });
});
