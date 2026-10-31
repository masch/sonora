/**
 * The `pois` layer draws every kind it admits — the invariant whose absence made every
 * hotel, guest house and cabin in Calamuchita invisible while its data sat in the tiles.
 *
 * Nothing here renders anything and nothing here needs the network or an archive: the style
 * is JSON, `icon-image` is an expression *as data*, and the icon names are a list. So the
 * check that used to require a phone, a published tile and a pair of eyes runs on every
 * commit instead.
 *
 * Two rules shape it. The admitted kinds are **read from the style**, never restated here: a
 * hardcoded list would keep passing while the layer it claims to describe stopped admitting
 * them. And the failure is a test, not a blank square: a kind that resolves to an icon the
 * published sheet does not carry draws nothing at all — MapLibre has no fallback glyph — so
 * the gap has to be loud somewhere, and this is the loudest place available offline.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OUR_ICON_NAMES } from '../../../scripts/map-sprites/icons';
import {
  OUR_SPRITE_ICONS,
  UPSTREAM_SPRITE_ICONS,
  spriteIconNames,
} from '../../../packages/shared/src/map/sprite-icons';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));

/** The style, narrowed to the shape this test reads: a layer id, a filter and a layout. */
const STYLE = JSON.parse(readFileSync(join(REPO, 'assets/map/styles/v1.json'), 'utf8')) as {
  layers: Array<{
    id: string;
    filter?: unknown;
    layout?: Record<string, unknown>;
  }>;
};

/** The kinds the style maps to the bed and the tent, by kind, as the style writes them. */
const LODGING_KINDS = [
  'guest_house',
  'hotel',
  'hostel',
  'chalet',
  'apartment',
  'motel',
  'bed_and_breakfast',
];

const CAMPING_KINDS = ['camp_site', 'caravan_site', 'alpine_hut', 'wilderness_hut'];

/**
 * Admitted kinds whose icon name the published sheet does not carry, so they draw nothing.
 *
 * `townhall` is the one inherited case: the filter admits it, `icon-image` falls through to
 * `["get","kind"]`, and the pinned upstream light sheet has no `townhall` glyph. It is the
 * same defect this test exists to catch, pre-dating the lodging work and outside its scope;
 * it is recorded here rather than fixed, and the set is asserted to be exactly this, so a
 * new gap cannot hide behind it and fixing this one means deleting the entry.
 */
const KNOWN_ICONLESS_KINDS: readonly string[] = ['townhall'];

/** The 36 kinds the filter admitted before the lodging kinds were added. */
const ADMITTED_BEFORE = [
  'beach',
  'forest',
  'marina',
  'park',
  'peak',
  'zoo',
  'garden',
  'bench',
  'aerodrome',
  'station',
  'bus_stop',
  'ferry_terminal',
  'stadium',
  'university',
  'library',
  'school',
  'animal',
  'toilets',
  'drinking_water',
  'post_office',
  'building',
  'townhall',
  'restaurant',
  'fast_food',
  'cafe',
  'bar',
  'supermarket',
  'convenience',
  'books',
  'beauty',
  'electronics',
  'clothes',
  'attraction',
  'museum',
  'theatre',
  'artwork',
];

function poisLayer() {
  const found = STYLE.layers.find((candidate) => candidate.id === 'pois');
  if (found === undefined) throw new Error('the style has no layer "pois"');
  return found;
}

/** True for the `["get","kind"]` expression, compared as data the way the style is written. */
function isGetKind(expression: unknown): boolean {
  return JSON.stringify(expression) === JSON.stringify(['get', 'kind']);
}

/**
 * Every kind the `pois` filter admits, read out of its
 * `["in", ["get","kind"], ["literal", [<kinds>]]]` expression.
 *
 * The filter is `["all", <kinds-test>, <zoom-test>]`; only the kinds test is read, because the
 * zoom test says *when* a kind is drawn, not *whether* it has an icon.
 */
function admittedKinds(): string[] {
  const filter = poisLayer().filter;
  if (!Array.isArray(filter)) throw new Error('the "pois" filter is not an expression');
  const all = filter.slice(1);
  for (const clause of all) {
    if (!Array.isArray(clause) || clause[0] !== 'in' || !isGetKind(clause[1])) continue;
    const literal = clause[2];
    if (!Array.isArray(literal) || literal[0] !== 'literal') {
      throw new Error(
        `the kinds test is not a ["literal", [...]] expression: ${JSON.stringify(clause)}`,
      );
    }
    const kinds = literal[1];
    if (!Array.isArray(kinds) || kinds.some((kind) => typeof kind !== 'string')) {
      throw new Error(`the admitted kinds are not a list of names: ${JSON.stringify(kinds)}`);
    }
    return kinds as string[];
  }
  throw new Error('the "pois" filter has no ["in", ["get","kind"], ...] expression');
}

/** The value an `icon-image` output expression names for a feature whose only tag is `kind`. */
function iconOf(output: unknown, kind: string): string {
  if (typeof output === 'string') return output;
  if (isGetKind(output)) return kind;
  throw new Error(`this test cannot evaluate the icon output ${JSON.stringify(output)}`);
}

/**
 * The icon the `icon-image` expression resolves to for one kind, evaluated as data.
 *
 * MapLibre's `match` is `["match", <input>, <label>, <output>, ..., <fallback>]`, where a label
 * is one value or an array of them — which is how eleven kinds share two icons. Evaluating it
 * here instead of in a renderer is what lets the check run without a browser, a sprite image
 * or the tiles.
 */
function iconFor(kind: string): string {
  const expression = poisLayer().layout?.['icon-image'];
  if (!Array.isArray(expression) || expression[0] !== 'match') {
    throw new Error(
      `the "pois" icon-image is not a match expression: ${JSON.stringify(expression)}`,
    );
  }
  if (!isGetKind(expression[1])) {
    throw new Error(
      `the "pois" match does not switch on ["get","kind"]: ${JSON.stringify(expression[1])}`,
    );
  }
  const branches = expression.slice(2);
  // Pairs of label and output, then one fallback: an even number of branches is malformed.
  if (branches.length % 2 === 0) {
    throw new Error(`the "pois" match has no fallback: ${JSON.stringify(expression)}`);
  }
  for (let index = 0; index < branches.length - 1; index += 2) {
    const label = branches[index];
    const matched = Array.isArray(label) ? label.includes(kind) : label === kind;
    if (matched) return iconOf(branches[index + 1], kind);
  }
  return iconOf(branches[branches.length - 1], kind);
}

/** One iconless kind, named the way the report names it. */
function iconlessReport(kind: string): string {
  return `kind "${kind}" resolves to icon "${iconFor(kind)}", which the sprite does not carry`;
}

describe('the published sheet carries the icons the style names', () => {
  it('lists the 53 upstream icons of the pinned sheet, each once, plus our two', () => {
    const upstream = [...UPSTREAM_SPRITE_ICONS];
    expect(upstream).toHaveLength(53);
    expect(new Set(upstream).size).toBe(53);
    expect(spriteIconNames()).toEqual([...upstream, ...OUR_SPRITE_ICONS]);
  });

  it('keeps the shared icon list identical to the icons this repository draws', () => {
    // Two lists, one truth: `scripts/map-sprites/icons.ts` renders `lodging` and `camping`,
    // and this module claims those names are on the sheet. Drift either way is a POI that
    // asks for an icon nothing draws.
    expect([...OUR_SPRITE_ICONS]).toEqual([...OUR_ICON_NAMES]);
  });
});

describe('the pois layer draws every kind it admits', () => {
  it('resolves every admitted kind to an icon the sprite carries', () => {
    const carried = new Set<string>(spriteIconNames());
    const iconless = admittedKinds().filter((kind) => !carried.has(iconFor(kind)));
    const unexplained = iconless.filter((kind) => !KNOWN_ICONLESS_KINDS.includes(kind));
    expect(unexplained.map(iconlessReport), unexplained.map(iconlessReport).join('\n')).toEqual([]);
    // The known gap stays exactly as reported: a fixed one has to delete its entry here.
    expect(iconless).toEqual([...KNOWN_ICONLESS_KINDS]);
  });

  it('admits the seven lodging kinds and draws them with the bed', () => {
    const admitted = admittedKinds();
    for (const kind of LODGING_KINDS) {
      expect(admitted, `kind "${kind}" is not in the "pois" filter`).toContain(kind);
      // Checked as an exact icon, not merely as "something the sheet carries": a kind left to
      // the `["get","kind"]` fallback would resolve to its own name and prove nothing.
      expect(iconFor(kind), `kind "${kind}"`).toBe('lodging');
    }
  });

  it('admits the four camping kinds and draws them with the tent', () => {
    const admitted = admittedKinds();
    for (const kind of CAMPING_KINDS) {
      expect(admitted, `kind "${kind}" is not in the "pois" filter`).toContain(kind);
      expect(iconFor(kind), `kind "${kind}"`).toBe('camping');
    }
  });

  it('still draws a station as a train', () => {
    // The one exception the layer already had; the lodging cases were added around it, not
    // over it, and a station that lost its icon is the same bug as a hotel without one.
    expect(iconFor('station')).toBe('train_station');
    expect(spriteIconNames()).toContain('train_station');
  });

  it('still admits every kind it admitted before the lodging kinds', () => {
    // S3: additive only. These 36 drew before this change and have to keep drawing.
    const admitted = new Set(admittedKinds());
    const dropped = ADMITTED_BEFORE.filter((kind) => !admitted.has(kind));
    expect(dropped).toEqual([]);
  });
});
