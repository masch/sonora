import { describe, expect, it } from 'vitest';

import {
  buildReferenceStyleLayers,
  REFERENCE_SOURCE_PREFIX,
  WORLD_POINTS_DOCUMENT_KEY,
  worldDocuments,
} from '../map';

const SOURCE = `${REFERENCE_SOURCE_PREFIX}sendero`;

/** The one layer the builder emitted with this id, or `undefined` when it emitted none. */
function layerWith(
  id: string,
  options: Parameters<typeof buildReferenceStyleLayers>[1] = { bold: true },
) {
  return buildReferenceStyleLayers(SOURCE, options).find((layer) => layer.id === id);
}

/**
 * The world hub separates the names it draws from the basemap's own names by weight.
 *
 * The basemap keeps every name it publishes, so the experiences cannot be told apart by
 * the absence of anything underneath them: they carry a larger label, a heavier halo, a
 * bigger dot and a tap target wider than the dot. These numbers are the whole of that
 * decision, and they live in one module so a label that is 13 px on the web build is
 * 13 px on a device.
 */
describe('bold references: the hub’s markers carry their own weight', () => {
  it('names the tap target after the document, and draws it before the dot', () => {
    const ids = buildReferenceStyleLayers(SOURCE, { bold: true }).map((layer) => layer.id);

    expect(ids).toEqual([
      `${SOURCE}:fill`,
      `${SOURCE}:line`,
      `${SOURCE}:circle-hit`,
      `${SOURCE}:circle`,
      `${SOURCE}:label`,
    ]);
    // The id names the document (`refs:<key>:circle-hit`), because both renderers answer
    // a press by asking which reference layer was touched and read the key out of
    // whichever one it was. MapLibre draws in array order, so the target is added first
    // and the dot the walker reads is drawn over it.
    expect(ids.indexOf(`${SOURCE}:circle-hit`)).toBeLessThan(ids.indexOf(`${SOURCE}:circle`));
  });

  it('makes the tap target wider than the dot, and still draws it', () => {
    const hit = layerWith(`${SOURCE}:circle-hit`);

    expect(hit?.type).toBe('circle');
    expect(hit?.paint?.['circle-radius']).toBe(16);
    // Just above zero: a layer at opacity 0 is not drawn, and a layer that is not drawn
    // is not hit. The number is what makes the target real without making it visible.
    expect(hit?.paint?.['circle-opacity']).toBe(0.01);
    // The target is the same points the dot draws, gated by the same per-feature zoom.
    expect(hit?.filter).toEqual(layerWith(`${SOURCE}:circle`)?.filter);
  });

  it('draws the dot at radius 11 with a 3 white stroke', () => {
    const circle = layerWith(`${SOURCE}:circle`);

    expect(circle?.paint?.['circle-radius']).toBe(6);
    expect(circle?.paint?.['circle-stroke-width']).toBe(2);
    expect(circle?.paint?.['circle-stroke-color']).toBe('#ffffff');
  });

  it('grows the label from 11 px at z13 to 12 px at z15, with a 3 halo, in the heavier face', () => {
    const label = layerWith(`${SOURCE}:label`);

    expect(label?.layout?.['text-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      13,
      11,
      15,
      12,
    ]);
    expect(label?.paint?.['text-halo-width']).toBe(3);
    expect(label?.layout?.['text-font']).toEqual(['Noto Sans Medium']);
  });

  it('wraps the bold label at 6 em, so its bigger glyphs stay as wide as the classic label', () => {
    // 8 em at the classic 12 px was 96 px; 8 em at the bold 16 px would be 128 px and
    // outrun the opening frame's side margin. Six em is 96 px again: the weight comes
    // from the face and the size, not from a wider column. The world hub's own labels
    // are the movable ones, which is where the wrap lives.
    const label = layerWith(`${SOURCE}:label`, { bold: true, movableLabels: true });
    expect(label?.layout?.['text-max-width']).toBe(20);
  });

  it('stacks the hub label above or below its dot before it moves sideways', () => {
    // Two documents, two crowds, two orders. The hub's points sit close together on a tall
    // card, so a label that stacks vertically stays inside the frame; the detail map's
    // crowds run along a road, where a label beside its point is the unambiguous one. The
    // split is what keeps the leftmost experience from being drawn outside the card.
    const hub = layerWith(`${SOURCE}:label`, { bold: true, movableLabels: true });
    const detail = layerWith(`${SOURCE}:label`, { movableLabels: true });

    expect(hub?.layout?.['text-variable-anchor']).toEqual(['left', 'top', 'bottom', 'right']);
    expect(detail?.layout?.['text-variable-anchor']).toEqual(['left', 'right', 'top', 'bottom']);
  });

  it('lets the hub draw every name and keeps the classic label culled', () => {
    const hub = layerWith(`${SOURCE}:label`, { bold: true, movableLabels: true });
    const classic = layerWith(`${SOURCE}:label`, { movableLabels: true });

    // Culling stays on, because with it off MapLibre never advances past the first
    // anchor: it would put every name above its dot and give up on the sides. The hub
    // orders right first, where the northern cluster has room, and falls back to the
    // vertical sides; the detail map keeps its horizontal-first order for a road crowd.
    expect(hub?.layout?.['text-allow-overlap']).toBe(false);
    expect(classic?.layout?.['text-allow-overlap']).toBe(false);
    // The value names the side of the text pinned to the point, so `left` is the one that
    // makes a name grow to the RIGHT of its dot. The hub asks for that first because its
    // northern cluster sits on the left of the card, where a name growing leftwards runs
    // off the edge and one growing upwards collides with its neighbour.
    expect(hub?.layout?.['text-variable-anchor']).toEqual(['left', 'top', 'bottom', 'right']);
    // The weight replaces the size, not the placement.
    expect(hub?.layout?.['text-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      13,
      11,
      15,
      12,
    ]);
  });

  it('draws the target and the dot even when the style has no glyphs source', () => {
    // Weight is not labels: a style without glyphs loses its label layer and keeps a
    // marker the walker can still see and still open.
    const withoutLabels = buildReferenceStyleLayers(SOURCE, { bold: true, includeLabels: false });

    expect(withoutLabels.map((layer) => layer.id)).toEqual([
      `${SOURCE}:fill`,
      `${SOURCE}:line`,
      `${SOURCE}:circle-hit`,
      `${SOURCE}:circle`,
    ]);
  });
});

/**
 * Everything that is not the hub draws today's markers, and "not the hub" is the
 * default: a caller that asks for nothing gets the dot at radius 6 and no target at all,
 * exactly as before the hub's markers were separated.
 */
describe('without bold: today’s markers, unchanged', () => {
  it('emits the four classic layers and no tap target', () => {
    const layers = buildReferenceStyleLayers(SOURCE);

    expect(layers.map((layer) => layer.id)).toEqual([
      `${SOURCE}:fill`,
      `${SOURCE}:line`,
      `${SOURCE}:circle`,
      `${SOURCE}:label`,
    ]);
    expect(layerWith(`${SOURCE}:circle`, {})?.paint).toMatchObject({
      'circle-radius': 6,
      'circle-stroke-width': 2,
    });
    expect(layerWith(`${SOURCE}:label`, {})?.layout?.['text-size']).toBe(12);
    expect(layerWith(`${SOURCE}:label`, {})?.paint?.['text-halo-width']).toBe(1.4);
  });

  it('reads an explicit false as no weight at all', () => {
    // The switch hands the value down, so `false` is a real input and not a spelling of
    // the default that could drift from it.
    expect(buildReferenceStyleLayers(SOURCE, { bold: false })).toEqual(
      buildReferenceStyleLayers(SOURCE),
    );
  });
});

/**
 * The side a name grows towards describes the frame, not the slice a filter left.
 *
 * With one eastern experience left on a map still framed to the whole world, measuring
 * only what is drawn would make that point the westmost one, so its name would grow east
 * and be clipped. The caller passes the unfiltered longitudes for exactly this case.
 */
describe('label side follows the camera frame', () => {
  const experience = (slug: string, longitude: number) => ({
    slug,
    title: slug.toUpperCase(),
    format: 'track' as const,
    latitude: -32.19,
    longitude,
    durationSeconds: 600,
    free: true,
  });

  /** The properties of the one point in the points document. */
  const sideOf = (documents: ReturnType<typeof worldDocuments>, slug: string) => {
    const points = documents.find((document) => document.key === WORLD_POINTS_DOCUMENT_KEY);
    const feature = points?.collection.features.find(
      (candidate) => candidate.properties.experienceSlug === slug,
    );
    return feature?.properties.labelSide;
  };

  it('keeps the eastern point on its own side when a filter leaves it alone', () => {
    const east = experience('manifiesto', -64.731576);
    const west = experience('lavandas', -64.752621);

    const wholeWorld = worldDocuments([east, west], { language: 'es' });
    const eastAlone = worldDocuments([east], {
      language: 'es',
      frameLongitudes: [west.longitude, east.longitude],
    });

    expect(sideOf(wholeWorld, 'manifiesto')).toBe('west');
    expect(sideOf(eastAlone, 'manifiesto')).toBe('west');
  });

  it('leaves a point in the middle of the frame growing east', () => {
    const west = experience('lavandas', -64.752621);
    const middle = experience('nina', -64.744619);
    const east = experience('manifiesto', -64.731576);

    const documents = worldDocuments([west, middle, east], { language: 'es' });

    expect(sideOf(documents, 'nina')).toBeUndefined();
  });
});
