import { useEffect, useRef, useState } from 'react';

import type { StyleSpecification } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';

/**
 * Loads a PMTiles archive **whole** and serves its tiles from memory.
 *
 * Why not point MapLibre at the remote archive: PMTiles reads by byte ranges, and
 * the API route that serves the public bucket does not support them — it answers
 * 200 with the entire object, so the client fails with "Server returned no
 * content-length header… Byte Serving". Downloading once also avoids the dozens of
 * origin-latency range requests the bucket would pay, since it is not behind a CDN.
 *
 * The same download is what the offline pack will use on device.
 */

/** Minimal in-memory source, the shape `PMTiles` expects. */
interface MemorySource {
  getKey(): string;
  getBytes(offset: number, length: number): Promise<{ data: ArrayBuffer }>;
}

interface MapLibreWithProtocols {
  addProtocol(
    scheme: string,
    handler: (params: { url: string; type?: string }) => Promise<unknown>,
  ): void;
}

export type MapSourceStatus = 'loading' | 'ready' | 'error';

export interface MapSourceState {
  status: MapSourceStatus;
  /** `sonora://<key>`, ready to be used as a vector source url. */
  sourceUrl?: string;
  /** Style fetched from R2, when a url is configured. */
  style?: StyleSpecification;
  /** Size of the downloaded archive, for the UI and for tests. */
  bytes?: number;
  error?: string;
}

/** One registry per page: the protocol is global to MapLibre, the archives are not. */
const archives = new Map<string, PMTiles>();
const sizes = new Map<string, number>();
const styles = new Map<string, StyleSpecification>();
const headers = new Map<string, { minZoom: number; maxZoom: number; bounds: number[] }>();
let protocolRegistered = false;

function keyFor(url: string): string {
  return url.replace(/[^a-z0-9]+/gi, '-').slice(-48);
}

/**
 * Fetches a style document, failing loudly instead of handing back a partial one.
 * Returns undefined when no style is configured.
 */
async function fetchStyle(url?: string): Promise<StyleSpecification | undefined> {
  if (!url) return undefined;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`style ${response.status} ${response.statusText}`);
  return (await response.json()) as StyleSpecification;
}

/**
 * Downloads an archive (and its style, when configured) into the page registry.
 * Exported so it can be exercised directly, without mounting a component.
 */
export async function loadArchive(archiveUrl: string, styleUrl?: string): Promise<MapSourceState> {
  // El estilo y el archivo no dependen entre sí: se piden en paralelo.
  const [response, style] = await Promise.all([fetch(archiveUrl), fetchStyle(styleUrl)]);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const buffer = await response.arrayBuffer();
  const key = keyFor(archiveUrl);

  const source: MemorySource = {
    getKey: () => key,
    getBytes: (offset, length) => Promise.resolve({ data: buffer.slice(offset, offset + length) }),
  };

  const archive = new PMTiles(source);
  const header = await archive.getHeader();

  archives.set(key, archive);
  sizes.set(key, buffer.byteLength);
  if (style) styles.set(key, style);
  headers.set(key, {
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
  });

  return {
    status: 'ready',
    sourceUrl: `sonora://${key}`,
    bytes: buffer.byteLength,
    ...(style ? { style } : {}),
  };
}

/**
 * Registers the custom protocol once. It answers two things, because MapLibre
 * asks for the TileJSON first and only then substitutes `{z}/{x}/{y}` into the
 * template that TileJSON returned.
 */
export function ensureLocalProtocol(maplibregl: MapLibreWithProtocols): void {
  if (protocolRegistered) return;

  maplibregl.addProtocol('sonora', async (params: { url: string; type?: string }) => {
    if (params.type === 'json') {
      const key = params.url.replace(/^sonora:\/\//, '');
      const header = headers.get(key);
      if (!header) throw new Error(`unknown archive: ${params.url}`);
      return {
        data: {
          tiles: [`sonora://${key}/{z}/{x}/{y}`],
          minzoom: header.minZoom,
          maxzoom: header.maxZoom,
          bounds: header.bounds,
        },
      };
    }

    const match = params.url.match(/^sonora:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)$/);
    if (!match) throw new Error(`unexpected url: ${params.url}`);

    const archive = archives.get(match[1]);
    if (!archive) throw new Error(`unknown archive: ${match[1]}`);

    const tile = await archive.getZxy(Number(match[2]), Number(match[3]), Number(match[4]));
    return { data: tile ? new Uint8Array(tile.data) : new Uint8Array() };
  });

  protocolRegistered = true;
}

/**
 * Downloads the archive and returns the source url to draw from.
 *
 * @param archiveUrl remote url of the `.pmtiles`, or undefined when the map has
 *                   no archive configured yet.
 * @param styleUrl   remote url of the MapLibre style, when one is configured.
 */
export function useMapSource(archiveUrl: string | undefined, styleUrl?: string): MapSourceState {
  // The status is derived from the registry, so the effect never has to reset it.
  const [result, setResult] = useState<{ key: string; state: MapSourceState } | null>(null);
  const cancelledRef = useRef(false);
  const key = archiveUrl ? keyFor(archiveUrl) : null;

  useEffect(() => {
    if (!key || !archiveUrl) return;
    if (archives.has(key)) return;

    cancelledRef.current = false;

    loadArchive(archiveUrl, styleUrl)
      .then((state) => {
        if (!cancelledRef.current) setResult({ key, state });
      })
      .catch((error: unknown) => {
        if (cancelledRef.current) return;
        setResult({
          key,
          state: {
            status: 'error',
            error: error instanceof Error ? error.message : 'archive download failed',
          },
        });
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [archiveUrl, key, styleUrl]);

  if (!key) return { status: 'error', error: 'no archive configured' };
  if (archives.has(key)) {
    const style = styles.get(key);
    return {
      status: 'ready',
      sourceUrl: `sonora://${key}`,
      bytes: sizes.get(key),
      ...(style ? { style } : {}),
    };
  }
  if (result?.key === key) return result.state;
  return { status: 'loading' };
}
