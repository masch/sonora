/**
 * scripts/map-sprites/raster.ts — drawing in a 19-unit box, supersampled four times.
 *
 * A sprite icon is 19×19 at pixel ratio 1 and 38×38 at ratio 2, and the two have to be
 * the same drawing at two sizes, not two drawings that happen to be square. So the
 * shapes are written once in *unit* coordinates (a 0..19 box), and the painter scales
 * them to whichever ratio is being written.
 *
 * Anti-aliasing is supersampling, not a coverage formula: the painter renders into a
 * canvas `SCALE` times larger with hard edges, then averages each block down. That
 * keeps every primitive honest — a polygon, a line and a disc all get the same edge
 * treatment because they all go through the same downsample — and it costs nothing at
 * this size (a 152×152 canvas for the @2x sheet).
 *
 * Colours are opaque; transparency is what the downsample produces at the edges. That
 * is deliberate: the sheet is a flat icon atlas, so a primitive that painted a
 * translucent colour would be a mistake worth surfacing, and the painter refuses one.
 */
import type { Raster } from './png';

/** Straight RGBA, 8 bits per sample. */
export type Colour = readonly [number, number, number, number];

/** How many subpixels each side of a drawn pixel is split into before averaging. */
export const SCALE = 4;

/** A point in unit space. */
export type Point = readonly [number, number];

/** A canvas `SCALE` times the unit box, painted with hard edges and averaged at the end. */
export class Painter {
  readonly #unitSize: number;
  readonly #ratio: number;
  readonly #width: number;
  readonly #data: Uint8Array;

  constructor(unitSize: number, ratio: number) {
    this.#unitSize = unitSize;
    this.#ratio = ratio;
    this.#width = unitSize * ratio * SCALE;
    this.#data = new Uint8Array(this.#width * this.#width * 4);
  }

  /**
   * Unit coordinates to subpixel coordinates.
   *
   * One unit is one pixel at pixel ratio 1, so a unit is `ratio * SCALE` subpixels and
   * the box's own size cancels: a 19-unit icon at ratio 2 fills a 38 px square because
   * 19 units times 2 is 38, not because 19 happens to be the box.
   */
  #sub(value: number): number {
    return value * this.#ratio * SCALE;
  }

  /** Paints one subpixel. Anything outside the canvas is dropped, never wrapped. */
  #paint(x: number, y: number, colour: Colour): void {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= this.#width || py >= this.#width) return;
    if (colour[3] !== 255) {
      throw new Error(`sprite primitives must be opaque; got alpha ${colour[3]}`);
    }
    const at = (py * this.#width + px) * 4;
    this.#data[at] = colour[0];
    this.#data[at + 1] = colour[1];
    this.#data[at + 2] = colour[2];
    this.#data[at + 3] = 255;
  }

  /** Fills any simple polygon, by even-odd ray casting at each subpixel centre. */
  polygon(points: readonly Point[], colour: Colour): this {
    const scaled = points.map(([x, y]) => [this.#sub(x), this.#sub(y)] as const);
    const minY = Math.max(0, Math.floor(Math.min(...scaled.map(([, y]) => y))));
    const maxY = Math.min(this.#width - 1, Math.ceil(Math.max(...scaled.map(([, y]) => y))));
    const minX = Math.max(0, Math.floor(Math.min(...scaled.map(([x]) => x))));
    const maxX = Math.min(this.#width - 1, Math.ceil(Math.max(...scaled.map(([x]) => x))));

    for (let y = minY; y <= maxY; y += 1) {
      const sample = y + 0.5;
      for (let x = minX; x <= maxX; x += 1) {
        let inside = false;
        for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i, i += 1) {
          const [xi, yi] = scaled[i];
          const [xj, yj] = scaled[j];
          if (
            yi > sample !== yj > sample &&
            x + 0.5 < ((xj - xi) * (sample - yi)) / (yj - yi) + xi
          ) {
            inside = !inside;
          }
        }
        if (inside) this.#paint(x, y, colour);
      }
    }
    return this;
  }

  /** Fills a disc. */
  circle(cx: number, cy: number, radius: number, colour: Colour): this {
    const ax = this.#sub(cx);
    const ay = this.#sub(cy);
    const ar = this.#sub(radius);
    const minX = Math.max(0, Math.floor(ax - ar));
    const maxX = Math.min(this.#width - 1, Math.ceil(ax + ar));
    const minY = Math.max(0, Math.floor(ay - ar));
    const maxY = Math.min(this.#width - 1, Math.ceil(ay + ar));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - ax;
        const dy = y + 0.5 - ay;
        if (dx * dx + dy * dy <= ar * ar) this.#paint(x, y, colour);
      }
    }
    return this;
  }

  /** Fills an axis-aligned rectangle. */
  rect(x: number, y: number, width: number, height: number, colour: Colour): this {
    return this.polygon(
      [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ],
      colour,
    );
  }

  /**
   * The outline of a rectangle with rounded corners, as a point path.
   *
   * Returned as points rather than painted so the same path can be stroked at any
   * width: the corner arcs are sampled dense enough that a round join has nothing to
   * fix, which is what keeps a rounded box from looking chamfered at @2x.
   */
  roundRectPath(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    steps = 6,
  ): Point[] {
    const r = Math.min(radius, width / 2, height / 2);
    const corners: Array<[number, number, number]> = [
      [x + width - r, y + r, -Math.PI / 2],
      [x + width - r, y + height - r, 0],
      [x + r, y + height - r, Math.PI / 2],
      [x + r, y + r, Math.PI],
    ];
    const path: Point[] = [];
    for (const [cx, cy, from] of corners) {
      for (let step = 0; step <= steps; step += 1) {
        const angle = from + (step / steps) * (Math.PI / 2);
        path.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
    }
    return path;
  }

  /** Fills a rounded rectangle. */
  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    colour: Colour,
  ): this {
    return this.polygon(this.roundRectPath(x, y, width, height, radius), colour);
  }

  /**
   * Strokes a point path with round caps and round joins.
   *
   * Every segment becomes a quad and every vertex a disc, which is what makes a corner
   * come out round instead of mitred: at 19 units a mitre is a spike, and the sheet's
   * own icons are all rounded.
   */
  stroke(points: readonly Point[], width: number, colour: Colour): this {
    const half = width / 2;
    for (let i = 0; i + 1 < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const nx = (-dy / length) * half;
      const ny = (dx / length) * half;
      this.polygon(
        [
          [x1 + nx, y1 + ny],
          [x2 + nx, y2 + ny],
          [x2 - nx, y2 - ny],
          [x1 - nx, y1 - ny],
        ],
        colour,
      );
    }
    for (const [x, y] of points) this.circle(x, y, half, colour);
    return this;
  }

  /** Averages the supersampled canvas down to the output size, un-premultiplying. */
  finish(): Raster {
    const size = this.#unitSize * this.#ratio;
    const data = new Uint8Array(size * size * 4);
    const block = SCALE * SCALE;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let alpha = 0;
        let red = 0;
        let green = 0;
        let blue = 0;
        for (let sy = 0; sy < SCALE; sy += 1) {
          for (let sx = 0; sx < SCALE; sx += 1) {
            const at = ((y * SCALE + sy) * this.#width + (x * SCALE + sx)) * 4;
            const a = this.#data[at + 3];
            alpha += a;
            red += this.#data[at] * a;
            green += this.#data[at + 1] * a;
            blue += this.#data[at + 2] * a;
          }
        }
        const at = (y * size + x) * 4;
        data[at + 3] = Math.round(alpha / block);
        if (alpha > 0) {
          data[at] = Math.round(red / alpha);
          data[at + 1] = Math.round(green / alpha);
          data[at + 2] = Math.round(blue / alpha);
        }
      }
    }
    return { width: size, height: size, data };
  }
}
