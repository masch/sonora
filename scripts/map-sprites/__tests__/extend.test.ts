/**
 * The atlas extension, asserted on a sheet this test builds itself.
 *
 * A synthetic sheet is the only way to assert the things that matter: the existing
 * icons keep their coordinates byte for byte, the new row is inked, both pixel ratios
 * move together, and a second run refuses instead of appending a duplicate. Running
 * this against the real Protomaps sheet would prove the same facts less precisely and
 * would need a network fetch to do it.
 */
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ICON_BOX } from '../icons';
import { decodePng, encodePng, type Raster } from '../png';
import { checkSheet, extendSheet } from '../extend';

/** A 40×19 sheet with one icon in it, named so the document has an entry to preserve. */
function syntheticSheet(): Raster {
  const raster: Raster = { width: 40, height: 19, data: new Uint8Array(40 * 19 * 4) };
  // A 5×5 block of opaque red at (2, 3), the "icon that was already there".
  for (let y = 3; y < 8; y += 1) {
    for (let x = 2; x < 7; x += 1) {
      raster.data.set([255, 0, 0, 255], (y * 40 + x) * 4);
    }
  }
  return raster;
}

/** The same drawing at twice the size, which is what a `@2x` sheet is. */
function doubled(source: Raster): Raster {
  const width = source.width * 2;
  const height = source.height * 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = ((y >> 1) * source.width + (x >> 1)) * 4;
      data.set(source.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Writes the four files a sprite base stands for into a fresh directory. */
function sheetDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sonora-sprite-'));
  const one = syntheticSheet();
  const two = doubled(one);

  writeFileSync(
    join(dir, 'light.json'),
    JSON.stringify({ existing: { x: 2, y: 3, width: 5, height: 5, pixelRatio: 1 } }),
  );
  writeFileSync(join(dir, 'light.png'), encodePng(one));
  writeFileSync(
    join(dir, 'light@2x.json'),
    JSON.stringify({ existing: { x: 4, y: 6, width: 10, height: 10, pixelRatio: 2 } }),
  );
  writeFileSync(join(dir, 'light@2x.png'), encodePng(two));
  return dir;
}

describe('extending the sheet', () => {
  it('adds a row, keeps every existing icon where it was, and inks the new boxes', () => {
    const dir = sheetDir();
    const before = decodePng(readFileSync(join(dir, 'light.png')));

    const notes = extendSheet(dir);

    expect(notes.length).toBe(2);
    const after = decodePng(readFileSync(join(dir, 'light.png')));
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height + ICON_BOX);
    // The old region is untouched, pixel for pixel.
    expect([...after.data.subarray(0, before.data.length)]).toEqual([...before.data]);

    const document = JSON.parse(readFileSync(join(dir, 'light.json'), 'utf8'));
    expect(document.existing).toEqual({ x: 2, y: 3, width: 5, height: 5, pixelRatio: 1 });
    expect(document.lodging).toEqual({
      x: 0,
      y: before.height,
      width: ICON_BOX,
      height: ICON_BOX,
      pixelRatio: 1,
    });
    expect(document.camping.x).toBe(ICON_BOX);
  });

  it('grows the @2x sheet by two of its own icon rows, not by one 1x row', () => {
    const dir = sheetDir();
    const before = decodePng(readFileSync(join(dir, 'light@2x.png')));

    extendSheet(dir);

    const after = decodePng(readFileSync(join(dir, 'light@2x.png')));
    expect(after.height).toBe(before.height + ICON_BOX * 2);
    const document = JSON.parse(readFileSync(join(dir, 'light@2x.json'), 'utf8'));
    expect(document.lodging.width).toBe(ICON_BOX * 2);
    expect(document.lodging.pixelRatio).toBe(2);
  });

  it('can be run again: a second run repaints in place instead of appending a row', () => {
    // The operator target, so it runs again after a failed publish or a re-fetch. Before this,
    // the second run threw and the only way out was a forced re-download.
    const dir = sheetDir();
    extendSheet(dir);
    const once = decodePng(readFileSync(join(dir, 'light.png')));
    const documentOnce = readFileSync(join(dir, 'light.json'), 'utf8');

    const notes = extendSheet(dir);

    const twice = decodePng(readFileSync(join(dir, 'light.png')));
    expect(twice.height).toBe(once.height);
    expect([...twice.data]).toEqual([...once.data]);
    expect(readFileSync(join(dir, 'light.json'), 'utf8')).toBe(documentOnce);
    expect(notes[0]).toContain('already carries lodging, camping');
  });

  it('repairs a box a partial write left blank, without a fresh download', () => {
    // A process killed between the image write and the document write — or between the two
    // ratios — leaves a sheet the next run has to be able to finish, not complain about.
    const dir = sheetDir();
    extendSheet(dir);
    const atlas = decodePng(readFileSync(join(dir, 'light.png')));
    atlas.data.fill(0, (atlas.height - ICON_BOX) * atlas.width * 4);
    writeFileSync(join(dir, 'light.png'), encodePng(atlas));
    expect(() => checkSheet(dir)).toThrow('light.png draws no ink for lodging');

    extendSheet(dir);

    expect(checkSheet(dir)).toHaveLength(2);
  });
});

describe('checking the sheet', () => {
  it('fails before the icons are added, naming the one that is missing', () => {
    const dir = sheetDir();

    expect(() => checkSheet(dir)).toThrow('light.json does not carry lodging');
  });

  it('passes once they are, for both ratios', () => {
    const dir = sheetDir();
    extendSheet(dir);

    expect(checkSheet(dir)).toEqual([
      'light.json: lodging, camping named and inked',
      'light@2x.json: lodging, camping named and inked',
    ]);
  });

  it('fails when the document names an icon the image does not draw', () => {
    const dir = sheetDir();
    extendSheet(dir);
    // Blank out the row the icons live in: the document still swears they are there.
    const atlas = decodePng(readFileSync(join(dir, 'light.png')));
    const blank: Raster = { ...atlas, data: new Uint8Array(atlas.data) };
    blank.data.fill(0, atlas.height - ICON_BOX * atlas.width * 4);
    writeFileSync(join(dir, 'light.png'), encodePng(blank));

    expect(() => checkSheet(dir)).toThrow('light.png draws no ink for lodging');
  });
});
