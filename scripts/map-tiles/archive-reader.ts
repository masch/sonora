/**
 * scripts/map-tiles/archive-reader.ts — what a tile actually carries, without a browser.
 *
 * The render check answers "does the style draw it?", and it can only answer that for text: it
 * runs offline, so a symbol that asks for a sprite icon never places, while glyphs fall back to
 * locally drawn ones. The objects that matter for the tiler — a building's `name`, an unnamed
 * `amenity=toilets` kept as a POI — are data, and data is what this reads: the tile, decoded.
 *
 * The archive is served from memory over loopback with byte ranges, because the `pmtiles` reader
 * speaks HTTP and `file://` is not one of the protocols it implements.
 */
import { readFileSync } from 'node:fs';

import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';

/**
 * The bit of Bun this module uses, declared here for the reason `render-check.ts` states: one
 * local server is not worth pulling `@types/bun` into the whole `scripts/` typecheck.
 */
declare const Bun: {
  serve(options: {
    port: number;
    hostname?: string;
    fetch: (request: Request) => Response | Promise<Response>;
  }): { port: number; stop(force?: boolean): void };
};

/** One decoded feature: its layer, and the properties the tiler wrote onto it. */
export interface ArchiveFeature {
  layer: string;
  properties: Record<string, unknown>;
}

/**
 * Serves one archive over loopback for the duration of `run`, then stops.
 *
 * Byte ranges are what the reader asks for, so they are answered from the buffer; the archive is
 * read once instead of per request, which is what kept a renderer from starving here before.
 */
async function withArchive<T>(archive: string, run: (pmtiles: PMTiles) => Promise<T>): Promise<T> {
  const buffer = readFileSync(archive);
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request: Request) {
      const range = request.headers.get('range');
      if (range === null) {
        return new Response(buffer, {
          headers: { 'content-length': String(buffer.length), 'accept-ranges': 'bytes' },
        });
      }
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match === null) return new Response('bad range', { status: 416 });

      const start = Number(match[1]);
      const end = match[2] === '' ? buffer.length - 1 : Number(match[2]);
      return new Response(buffer.subarray(start, end + 1), {
        status: 206,
        headers: {
          'content-range': `bytes ${start}-${end}/${buffer.length}`,
          'content-length': String(end - start + 1),
          'accept-ranges': 'bytes',
        },
      });
    },
  });

  try {
    return await run(new PMTiles(`http://127.0.0.1:${server.port}/archive.pmtiles`));
  } finally {
    server.stop(true);
  }
}

/** Every feature of one tile, in the order the tiler wrote them. */
export async function readTile(
  archive: string,
  tile: { z: number; x: number; y: number },
): Promise<ArchiveFeature[]> {
  return withArchive(archive, async (pmtiles) => {
    await pmtiles.getHeader();
    const found = (await pmtiles.getZxy(tile.z, tile.x, tile.y)) as { data?: ArrayBuffer } | null;
    if (found?.data === undefined) return [];

    const decoded = new VectorTile(new PbfReader(new Uint8Array(found.data)) as never);
    const features: ArchiveFeature[] = [];
    for (const [layer, vectorLayer] of Object.entries(decoded.layers)) {
      for (let index = 0; index < vectorLayer.length; index++) {
        features.push({
          layer,
          properties: vectorLayer.feature(index).properties as Record<string, unknown>,
        });
      }
    }
    return features;
  });
}
