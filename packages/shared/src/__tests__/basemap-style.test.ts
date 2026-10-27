/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ALWAYS_ON_LAYER_PREFIXES,
  MAP_LAYER_GROUPS,
  groupOfLayer,
  layerIdsForGroup,
} from '../map/layer-groups';

/**
 * The published basemap style, adopted into the repository as its source of truth.
 *
 * The file mirrors the bucket key it is published to (`styles/v1.json`), so it is
 * committed byte-for-byte as the style document an author wrote: it is data, not
 * code, and nothing here reformats it.
 *
 * This suite is the guard that keeps it honest against the layer-group
 * vocabulary. An unclaimed layer is drawn always and no toggle can hide it, so a
 * style edit that quietly escapes the selector has to fail here instead of on a
 * device where the layers checkbox does nothing.
 */
const STYLE_PATH = fileURLToPath(new URL('../../../../assets/map/styles/v1.json', import.meta.url));

/** One layer as the document carries it: an id and whatever else it authors. */
interface StyleLayer {
  id: string;
}

/** The parts of a style document this guard reads. */
interface StyleDocument {
  version: number;
  glyphs?: unknown;
  sprite?: unknown;
  sources?: Record<string, { url?: unknown }>;
  layers?: StyleLayer[];
}

const STYLE = JSON.parse(readFileSync(STYLE_PATH, 'utf8')) as StyleDocument;

/** The layer ids the document draws, in the order it draws them. */
const LAYER_IDS: readonly string[] = (STYLE.layers ?? []).map((layer) => layer.id);

/**
 * The layer ids no group claims, and why no toggle may ever hide them.
 *
 * Every entry is the canvas: the layer is the map itself, so switching it off
 * would leave a flat rectangle behind everything the user did ask for. They are
 * written out here rather than derived so that a style edit introducing a new
 * unclaimed layer fails this suite and forces the decision into review — a
 * derived list would grow silently.
 */
const UNTOGGLEABLE_LAYER_IDS: Readonly<Record<string, string>> = {
  background: 'the canvas itself: hiding it leaves a blank rectangle under every other layer',
  earth: 'the ground the whole map is drawn on, from the first zoom out',
  landcover: 'glaciers, sand and bare rock: without the ground there is nothing under the roads',
  earth_label_islands: 'an island name with no island under it is the same defect one zoom in',
};

/** Whether `value` is an absolute http(s) url, which is what the rewrite expects to find. */
function isAbsoluteHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** The `pmtiles://` source urls the document declares, without their scheme. */
function pmtilesUrls(): string[] {
  return Object.values(STYLE.sources ?? {})
    .map((source) => source?.url)
    .filter((url): url is string => typeof url === 'string' && url.startsWith('pmtiles://'))
    .map((url) => url.slice('pmtiles://'.length));
}

describe('the committed basemap style', () => {
  it('is a version 8 document with sources and a non-empty list of layers', () => {
    expect(STYLE.version).toBe(8);
    expect(Object.keys(STYLE.sources ?? {}).length).toBeGreaterThan(0);
    expect(Array.isArray(STYLE.layers)).toBe(true);
    expect(LAYER_IDS.length).toBeGreaterThan(0);
    for (const id of LAYER_IDS) expect(typeof id, JSON.stringify(id)).toBe('string');
  });

  it('keeps glyphs and sprite as absolute urls', () => {
    // The serve-time rewrite substitutes these two whatever they say, but only a
    // value a parser can read keeps that substitution meaningful: a relative or
    // missing url is a document no origin can be spliced into.
    expect(isAbsoluteHttpUrl(STYLE.glyphs), `glyphs: ${JSON.stringify(STYLE.glyphs)}`).toBe(true);
    expect(isAbsoluteHttpUrl(STYLE.sprite), `sprite: ${JSON.stringify(STYLE.sprite)}`).toBe(true);
  });

  it('keeps a pmtiles:// source url for the rewrite to re-point', () => {
    // The same reason one level down: the rewrite replaces the origin of a
    // `pmtiles://` url and keeps its path, so staging can never hand a browser
    // production tiles. Without such a source there is nothing to re-point.
    const urls = pmtilesUrls();

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(isAbsoluteHttpUrl(url), url).toBe(true);
  });

  it('claims every layer through a group, or records why it can never be toggled', () => {
    const unclaimed = LAYER_IDS.filter((id) => groupOfLayer(id) === null).sort();

    // Exact set equality, not a subset: a new unclaimed id has to be justified in
    // the allowlist above, and an entry the document no longer draws has to be
    // removed. Both are decisions a reviewer should see in the diff.
    expect(unclaimed).toEqual(Object.keys(UNTOGGLEABLE_LAYER_IDS).sort());

    for (const [id, reason] of Object.entries(UNTOGGLEABLE_LAYER_IDS)) {
      expect(reason.length, `${id} needs a reason`).toBeGreaterThan(0);
      // The allowlist may only name the canvas: if `groupOfLayer` ever starts
      // claiming one of these, the vocabulary changed and this entry is a lie.
      const alwaysOn = ALWAYS_ON_LAYER_PREFIXES.some((prefix) => id.startsWith(prefix));
      expect(alwaysOn, `${id} is allowlisted but is not an always-on layer`).toBe(true);
    }
  });

  it('gives every group in the vocabulary at least one layer to switch', () => {
    // A toggle with nothing behind it is worse than no toggle: it promises a
    // choice that changes no pixel.
    for (const group of MAP_LAYER_GROUPS) {
      const owned = layerIdsForGroup(LAYER_IDS, group);
      expect(owned.length, `${group} claims no layer of the committed style`).toBeGreaterThan(0);
    }
  });
});
