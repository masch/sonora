/**
 * scripts/map-sprites/extend.ts — adds this repository's icons to the fetched sheet.
 *
 * The published sprite is Protomaps' own atlas at a pinned revision, and we own two
 * glyphs it does not have. Rather than fork the sheet, this appends them: the atlas
 * grows by one icon row at the bottom, every existing icon keeps its coordinates, and
 * the document gains two entries. Both pixel ratios are extended, because MapLibre asks
 * a high-density device for `@2x.json` **and** `@2x.png` — an icon in the 1x sheet only
 * would be a blank square on exactly the phones people carry.
 *
 * Where the files are and what they are called comes from `@sonora/shared`, the module
 * the upload targets and the app already read, so the three cannot disagree about the
 * layout of a sprite base.
 *
 * `--check` is the read-only side: it answers whether the sheet on disk already carries
 * every icon we own, with ink in the box the document claims. That is what the tests and
 * an operator run, and what keeps "the bytes were regenerated" from being a guess.
 *
 * Usage:
 *   bun scripts/map-sprites/extend.ts --dir=map-assets/sprites
 *   bun scripts/map-sprites/extend.ts --dir=map-assets/sprites --check
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { mapSpriteKey } from '../../packages/shared/src/map/artifacts';
import { drawIcon, ICON_BOX, OUR_ICON_NAMES, type OurIconName } from './icons';
import { decodePng, encodePng, type Raster } from './png';

/** The sprite base name the style names, taken from the layout module itself. */
const BASE = basename(mapSpriteKey());

/** One entry of a MapLibre sprite document. */
interface SpriteEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
}

type SpriteDocument = Record<string, SpriteEntry>;

/** The two pixel ratios, each a document and an image: `.json`/`.png` and `@2x`. */
const PAIRS = [
  { ratio: 1, document: `${BASE}.json`, image: `${BASE}.png` },
  { ratio: 2, document: `${BASE}@2x.json`, image: `${BASE}@2x.png` },
] as const;

const USAGE = [
  'Usage:',
  '  bun scripts/map-sprites/extend.ts --dir=<map-assets/sprites>',
  '  bun scripts/map-sprites/extend.ts --dir=<map-assets/sprites> --check',
].join('\n');

class ArgumentError extends Error {}

function parseArgs(argv: string[]): { dir: string; check: boolean } {
  let dir: string | undefined;
  let check = false;
  for (const arg of argv) {
    if (arg === '--check') check = true;
    else if (arg.startsWith('--dir=')) dir = arg.slice('--dir='.length);
    else throw new ArgumentError(`unknown argument ${arg}`);
  }
  if (!dir) throw new ArgumentError('missing --dir');
  return { dir, check };
}

/** Copies an icon onto the atlas at a pixel offset, leaving whatever is under it. */
function paste(target: Raster, source: Raster, atX: number, atY: number): void {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const from = (y * source.width + x) * 4;
      if (source.data[from + 3] === 0) continue;
      const to = ((atY + y) * target.width + (atX + x)) * 4;
      target.data.set(source.data.subarray(from, from + 4), to);
    }
  }
}

/** The existing atlas with one empty icon row appended at the bottom. */
function grown(atlas: Raster, rowHeight: number): Raster {
  const height = atlas.height + rowHeight;
  const data = new Uint8Array(atlas.width * height * 4);
  data.set(atlas.data, 0);
  return { width: atlas.width, height, data };
}

function readDocument(path: string): SpriteDocument {
  return JSON.parse(readFileSync(path, 'utf8')) as SpriteDocument;
}

/** Serialised with sorted keys, so two runs of the same input produce the same bytes. */
function writeDocument(path: string, document: SpriteDocument): void {
  const sorted: SpriteDocument = {};
  for (const name of Object.keys(document).sort()) sorted[name] = document[name];
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** Names of our icons the document already carries. */
function present(document: SpriteDocument): OurIconName[] {
  return OUR_ICON_NAMES.filter((name) => document[name] !== undefined);
}

/** Whether the box the document claims for an icon actually holds ink. */
function inked(atlas: Raster, entry: SpriteEntry): boolean {
  for (let y = entry.y; y < entry.y + entry.height; y += 1) {
    for (let x = entry.x; x < entry.x + entry.width; x += 1) {
      if (atlas.data[(y * atlas.width + x) * 4 + 3] !== 0) return true;
    }
  }
  return false;
}

/**
 * Appends every icon we own to both ratios of the sheet.
 *
 * Refuses a sheet that already carries them instead of appending a second copy: a
 * duplicated icon is not an error a renderer reports, it is an atlas that grew for no
 * reason and a document where one name points at one of two drawings.
 */
export function extendSheet(dir: string): string[] {
  const notes: string[] = [];

  for (const pair of PAIRS) {
    const documentPath = join(dir, pair.document);
    const imagePath = join(dir, pair.image);
    const document = readDocument(documentPath);
    const already = present(document);
    if (already.length > 0) {
      throw new Error(
        `${pair.document} already carries ${already.join(', ')} — the sheet is extended once. ` +
          'Re-run `make map-assets-fetch --force` for a pristine copy.',
      );
    }

    const atlas = decodePng(readFileSync(imagePath));
    const box = ICON_BOX * pair.ratio;
    if (OUR_ICON_NAMES.length * box > atlas.width) {
      throw new Error(
        `${pair.image} is ${atlas.width} px wide and ${OUR_ICON_NAMES.length} icons need ` +
          `${OUR_ICON_NAMES.length * box} px; the row does not fit`,
      );
    }

    const extended = grown(atlas, box);
    OUR_ICON_NAMES.forEach((name, index) => {
      const atX = index * box;
      paste(extended, drawIcon(name, pair.ratio), atX, atlas.height);
      document[name] = {
        x: atX,
        y: atlas.height,
        width: box,
        height: box,
        pixelRatio: pair.ratio,
      };
    });

    writeFileSync(imagePath, encodePng(extended));
    writeDocument(documentPath, document);
    notes.push(
      `${pair.image}: ${atlas.width}×${atlas.height} → ${extended.width}×${extended.height}, ` +
        `+${OUR_ICON_NAMES.length} icons at ratio ${pair.ratio}`,
    );
  }

  return notes;
}

/**
 * Reads the four files and reports, per icon, whether the document names it and the
 * image draws it. Throws on the first sheet that is missing something, naming it.
 */
export function checkSheet(dir: string): string[] {
  const notes: string[] = [];

  for (const pair of PAIRS) {
    const document = readDocument(join(dir, pair.document));
    const atlas = decodePng(readFileSync(join(dir, pair.image)));
    for (const name of OUR_ICON_NAMES) {
      const entry = document[name];
      if (!entry) throw new Error(`${pair.document} does not carry ${name}`);
      if (entry.width !== ICON_BOX * pair.ratio || entry.height !== ICON_BOX * pair.ratio) {
        throw new Error(
          `${pair.document} gives ${name} a ${entry.width}×${entry.height} box at ratio ` +
            `${pair.ratio}, expected ${ICON_BOX * pair.ratio}×${ICON_BOX * pair.ratio}`,
        );
      }
      if (entry.x + entry.width > atlas.width || entry.y + entry.height > atlas.height) {
        throw new Error(
          `${pair.document} places ${name} outside ${pair.image} (${atlas.width}×${atlas.height})`,
        );
      }
      if (!inked(atlas, entry)) throw new Error(`${pair.image} draws no ink for ${name}`);
    }
    notes.push(`${pair.document}: ${OUR_ICON_NAMES.join(', ')} named and inked`);
  }

  return notes;
}

if (import.meta.main) {
  try {
    const { dir, check } = parseArgs(process.argv.slice(2));
    for (const note of check ? checkSheet(dir) : extendSheet(dir)) console.log(note);
  } catch (error) {
    if (error instanceof ArgumentError) {
      // One line, the way a bad flag should read: the runtime's rejection dump names the
      // runtime instead of the argument that was wrong.
      console.error(`${error.message}\n${USAGE}`);
      process.exit(2);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
