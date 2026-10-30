/**
 * The painter, asserted on pixels: coverage where a shape is, nothing where it is not,
 * and partial alpha on the edge — which is the whole reason it supersamples.
 */
import { describe, expect, it } from 'bun:test';

import { Painter, SCALE } from '../raster';

const RED = [255, 0, 0, 255] as const;

/** Reads one pixel of a finished canvas. */
function pixel(data: Uint8Array, size: number, x: number, y: number): number[] {
  const at = (y * size + x) * 4;
  return [...data.subarray(at, at + 4)];
}

describe('a filled rectangle', () => {
  it('covers its own pixels and nothing outside them', () => {
    const raster = new Painter(4, 1).rect(1, 1, 2, 2, RED).finish();

    expect(raster.width).toBe(4);
    expect(pixel(raster.data, 4, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(pixel(raster.data, 4, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(raster.data, 4, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(raster.data, 4, 3, 3)).toEqual([0, 0, 0, 0]);
  });

  it('gives an edge that lands between pixels a partial alpha', () => {
    // Half a pixel in from the left: the first column is half covered, so the painter
    // has to average rather than round to opaque-or-nothing.
    const raster = new Painter(4, 1).rect(0.5, 0, 2, 2, RED).finish();
    const edge = pixel(raster.data, 4, 0, 0);

    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(255);
    // Un-premultiplied: the colour survives the averaging.
    expect(edge.slice(0, 3)).toEqual([255, 0, 0]);
  });

  it('averages a whole pixel to opaque when the shape covers it entirely', () => {
    const raster = new Painter(4, 1).rect(0, 0, 4, 4, RED).finish();
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) expect(pixel(raster.data, 4, x, y)[3]).toBe(255);
    }
  });
});

describe('a stroked path', () => {
  it('rounds the end caps, so a line fills the pixel at its end instead of half of it', () => {
    // A one-unit-wide horizontal line whose ends sit at pixel centres: the round cap
    // fills the two end pixels completely, where a butt cap would leave them half empty.
    const raster = new Painter(5, 1)
      .stroke(
        [
          [1.5, 2.5],
          [3.5, 2.5],
        ],
        1,
        RED,
      )
      .finish();

    // Not 255, and the number is the point: the end pixel is half stroke plus a quarter
    // disc, so a round cap lands near 0.89 coverage where a butt cap would leave it at
    // exactly half. Asserting the band above 200 is what tells the two apart.
    expect(pixel(raster.data, 5, 1, 2)[3]).toBeGreaterThan(200);
    expect(pixel(raster.data, 5, 3, 2)[3]).toBeGreaterThan(200);
  });

  it('leaves the pixels the path never touches empty', () => {
    const raster = new Painter(5, 1)
      .stroke(
        [
          [1, 1],
          [3, 3],
        ],
        1,
        RED,
      )
      .finish();

    expect(pixel(raster.data, 5, 4, 0)).toEqual([0, 0, 0, 0]);
  });
});

describe('a disc', () => {
  it('is round: the centre is opaque and the corner of its box is not', () => {
    const raster = new Painter(5, 1).circle(2.5, 2.5, 1.8, RED).finish();

    expect(pixel(raster.data, 5, 2, 2)[3]).toBe(255);
    expect(pixel(raster.data, 5, 0, 0)[3]).toBe(0);
  });
});

describe('the painter refuses what the sheet cannot hold', () => {
  it('rejects a translucent colour, because the atlas is flat', () => {
    expect(() => new Painter(4, 1).rect(0, 0, 1, 1, [255, 0, 0, 128])).toThrow(
      'sprite primitives must be opaque; got alpha 128',
    );
  });

  it('clips instead of wrapping when a shape leaves the canvas', () => {
    const raster = new Painter(4, 1).rect(-2, -2, 3, 3, RED).finish();

    expect(pixel(raster.data, 4, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(raster.data, 4, 3, 3)).toEqual([0, 0, 0, 0]);
  });
});

describe('pixel ratio', () => {
  it('draws the same shape at twice the size for ratio 2', () => {
    const one = new Painter(4, 1).rect(1, 1, 2, 2, RED).finish();
    const two = new Painter(4, 2).rect(1, 1, 2, 2, RED).finish();

    expect(two.width).toBe(one.width * 2);
    expect(pixel(two.data, 8, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(two.data, 8, 6, 6)).toEqual([0, 0, 0, 0]);
  });
});

describe('the supersample factor', () => {
  it('is what the edge assertions above assume', () => {
    expect(SCALE).toBe(4);
  });
});
