/**
 * The PNG reader and writer, asserted on PNGs — not on round trips of my own encoder.
 *
 * The sheet this codec exists to extend is written by a Rust rasterizer upstream, so a
 * test that only fed `decodePng` its own `encodePng` output would prove the two agree
 * with each other and nothing about the file that actually ships. Where the fetched
 * sheet is on disk it is decoded too, and the crafted cases pin what is refused, by
 * name, instead of decoded into an atlas of corrupt icons.
 */
import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { decodePng, encodePng, type Raster } from '../png';

const SHEET = join(import.meta.dir, '../../../map-assets/sprites/light.png');
const sheetMissing = existsSync(SHEET)
  ? false
  : `no sprite at ${SHEET} — run \`make map-assets-fetch\``;

/** A PNG with a hand-written IHDR, so an unsupported field can be pinned without a fixture. */
function pngWithHeader(bitDepth: number, interlace: number): Uint8Array {
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = new Uint8Array(13);
  header[0] = 0;
  header[1] = 0;
  header[2] = 0;
  header[3] = 2; // width 2
  header[4] = 0;
  header[5] = 0;
  header[6] = 0;
  header[7] = 1; // height 1
  header[8] = bitDepth;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = interlace;
  const body = new Uint8Array(12 + header.length);
  const view = new DataView(body.buffer);
  view.setUint32(0, header.length);
  body.set([73, 72, 68, 82], 4); // "IHDR"
  body.set(header, 8);
  const out = new Uint8Array(signature.length + body.length);
  out.set(signature);
  out.set(body, signature.length);
  return out;
}

describe('a PNG round trip', () => {
  it('keeps every sample of an RGBA image', () => {
    const source: Raster = {
      width: 3,
      height: 2,
      data: Uint8Array.from([
        0, 0, 0, 0, 255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 9, 9, 9, 1, 250, 250, 250, 254,
      ]),
    };

    const decoded = decodePng(encodePng(source));

    expect(decoded.width).toBe(3);
    expect(decoded.height).toBe(2);
    expect([...decoded.data]).toEqual([...source.data]);
  });

  it('refuses bytes that are not a PNG, by name', () => {
    expect(() => decodePng(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(
      'not a PNG: signature mismatch',
    );
  });

  it('refuses a bit depth it cannot decode instead of guessing', () => {
    expect(() => decodePng(pngWithHeader(16, 0))).toThrow(
      'unsupported PNG bit depth 16: the sprite sheet is 8-bit',
    );
  });

  it('refuses an interlaced image instead of decoding half of it', () => {
    expect(() => decodePng(pngWithHeader(8, 1))).toThrow(
      'unsupported PNG interlace method 1: the sprite sheet is not interlaced',
    );
  });
});

describe('the shipped sheet, read by this codec', () => {
  it.skipIf(sheetMissing !== false)(
    'decodes the sprite atlas Protomaps publishes',
    () => {
      // 256×114 is the 1x sheet, 53 icons of 19×19 packed by upstream's own rasterizer.
      // A wrong stride, a wrong filter or a wrong colour order would decode this into
      // noise rather than fail, so the assertion is on real ink: the atlas has opaque
      // pixels and a fully transparent border, which is what icon paste-back relies on.
      const sheet = decodePng(readFileSync(SHEET));

      expect(sheet.width).toBe(256);
      expect(sheet.height).toBe(114);

      let opaque = 0;
      let transparent = 0;
      for (let at = 0; at < sheet.data.length; at += 4) {
        if (sheet.data[at + 3] === 255) opaque += 1;
        if (sheet.data[at + 3] === 0) transparent += 1;
      }

      expect(opaque).toBeGreaterThan(5_000);
      expect(transparent).toBeGreaterThan(0);
    },
    60_000,
  );
});
