/**
 * scripts/map-sprites/png.ts — a PNG reader and writer, in Bun, without a dependency.
 *
 * The published sprite is a PNG atlas and ours has to grow by two icons, so the build
 * step that does it needs to read those bytes and write them back. `sharp`, `resvg`,
 * `pngjs` and friends are all native or binary packages, and adding one to the
 * repository root to append two images to an atlas is a bigger change than the codec:
 * this is 8-bit PNG, the format the sprite already is, and `node:zlib` does the only
 * part that is genuinely hard.
 *
 * What is supported is what the sheet is: colour types 0, 2, 3, 4 and 6 at bit depth 8,
 * filters 0–4, one IDAT stream. Interlacing, 16-bit samples and bit depths 1/2/4 are
 * refused **by name** instead of being decoded wrong, because a sprite that decodes
 * wrong is an atlas of corrupt icons that nothing would catch until a phone.
 *
 * Everything is RGBA between 8-bit samples in and out, so callers never see the file's
 * colour type: `decodePng` returns what a renderer needs, and `encodePng` writes type 6
 * with filter 0 — the atlas is written once and read many times, so a bigger file is
 * the cheaper trade than a slower encoder.
 */
import { deflateSync, inflateSync } from 'node:zlib';

/** A width, a height and `width * height * 4` RGBA samples. */
export interface Raster {
  width: number;
  height: number;
  /** Row-major RGBA, 8 bits per sample. */
  data: Uint8Array;
}

const PNG_MAGIC = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Bytes per pixel of a PNG colour type at bit depth 8, or 0 for an unsupported one. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function readU32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function writeU32(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = (value >>> 24) & 0xff;
  bytes[at + 1] = (value >>> 16) & 0xff;
  bytes[at + 2] = (value >>> 8) & 0xff;
  bytes[at + 3] = value & 0xff;
}

/**
 * The CRC-32 PNG puts on every chunk, over the type and the data.
 *
 * A table would be faster and this is a few hundred kilobytes per run, so the loop is
 * written out: the only thing that matters is that a reader downstream rejects a chunk
 * whose bytes we corrupted, and that it does so because we computed it wrong here.
 */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const toLeft = Math.abs(estimate - left);
  const toAbove = Math.abs(estimate - above);
  const toUpperLeft = Math.abs(estimate - upperLeft);
  if (toLeft <= toAbove && toLeft <= toUpperLeft) return left;
  return toAbove <= toUpperLeft ? above : upperLeft;
}

/** Reverses the per-scanline filter the encoder chose, one row at a time. */
function unfilter(raw: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = y * (stride + 1) + 1;
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[line + x];
      const left = x >= channels ? out[row + x - channels] : 0;
      const above = y > 0 ? out[previous + x] : 0;
      const upperLeft = y > 0 && x >= channels ? out[previous + x - channels] : 0;
      switch (filter) {
        case 0:
          out[row + x] = value;
          break;
        case 1:
          out[row + x] = (value + left) & 0xff;
          break;
        case 2:
          out[row + x] = (value + above) & 0xff;
          break;
        case 3:
          out[row + x] = (value + ((left + above) >> 1)) & 0xff;
          break;
        case 4:
          out[row + x] = (value + paeth(left, above, upperLeft)) & 0xff;
          break;
        default:
          throw new Error(`unsupported PNG filter ${filter} on row ${y}`);
      }
    }
  }
  return out;
}

/**
 * Reads a PNG into RGBA.
 *
 * Refuses, by name, the things the sprite is not: interlaced images and every bit depth
 * but 8. Guessing at those would produce an atlas that is quietly wrong.
 */
export function decodePng(bytes: Uint8Array): Raster {
  for (let i = 0; i < PNG_MAGIC.length; i += 1) {
    if (bytes[i] !== PNG_MAGIC[i]) throw new Error('not a PNG: signature mismatch');
  }

  let width = 0;
  let height = 0;
  let colorType = -1;
  let bitDepth = 0;
  let palette: Uint8Array | undefined;
  let transparency: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  let sawHeader = false;

  let at = PNG_MAGIC.length;
  while (at + 8 <= bytes.length) {
    const length = readU32(bytes, at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    at += 12 + length;

    if (type === 'IHDR') {
      width = readU32(body, 0);
      height = readU32(body, 4);
      bitDepth = body[8];
      colorType = body[9];
      const interlace = body[12];
      if (bitDepth !== 8) {
        throw new Error(`unsupported PNG bit depth ${bitDepth}: the sprite sheet is 8-bit`);
      }
      if (interlace !== 0) {
        throw new Error('unsupported PNG interlace method 1: the sprite sheet is not interlaced');
      }
      if (!CHANNELS[colorType]) throw new Error(`unsupported PNG colour type ${colorType}`);
      sawHeader = true;
    } else if (type === 'PLTE') {
      palette = body.slice();
    } else if (type === 'tRNS') {
      transparency = body.slice();
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!sawHeader) throw new Error('not a PNG: no IHDR chunk');
  if (idat.length === 0) throw new Error('not a PNG: no IDAT chunk');

  const channels = CHANNELS[colorType];
  const inflated = new Uint8Array(
    inflateSync(Buffer.concat(idat.map((part) => Buffer.from(part)))),
  );
  const pixels = unfilter(inflated, width, height, channels);

  const out = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 4;
    const r = pixels[source];
    switch (colorType) {
      case 6:
        out[target] = r;
        out[target + 1] = pixels[source + 1];
        out[target + 2] = pixels[source + 2];
        out[target + 3] = pixels[source + 3];
        break;
      case 2:
        out[target] = r;
        out[target + 1] = pixels[source + 1];
        out[target + 2] = pixels[source + 2];
        out[target + 3] = 255;
        break;
      case 0:
        out[target] = r;
        out[target + 1] = r;
        out[target + 2] = r;
        out[target + 3] = 255;
        break;
      case 4:
        out[target] = r;
        out[target + 1] = r;
        out[target + 2] = r;
        out[target + 3] = pixels[source + 1];
        break;
      case 3: {
        if (!palette) throw new Error('indexed PNG without a PLTE chunk');
        out[target] = palette[r * 3];
        out[target + 1] = palette[r * 3 + 1];
        out[target + 2] = palette[r * 3 + 2];
        out[target + 3] = transparency && r < transparency.length ? transparency[r] : 255;
        break;
      }
      default:
        throw new Error(`unsupported PNG colour type ${colorType}`);
    }
  }

  return { width, height, data: out };
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  writeU32(out, 0, body.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  writeU32(out, 8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

/** Writes RGBA as an 8-bit truecolour-with-alpha PNG, filter 0 on every row. */
export function encodePng(raster: Raster): Uint8Array {
  const { width, height, data } = raster;
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const header = new Uint8Array(13);
  writeU32(header, 0, width);
  writeU32(header, 4, height);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const parts = [
    PNG_MAGIC,
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(Buffer.from(raw), { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
