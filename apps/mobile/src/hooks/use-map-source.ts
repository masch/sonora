import { useEffect, useState } from 'react';

import type { StyleSpecification } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';

import { fetchStyleDocument, isDrawableStyle } from '@/services/map-style-cache';

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
  /**
   * The style document handed to MapLibre, from the network or from the client cache.
   *
   * Cached or freshly fetched, its `glyphs` and `sprite` are still fetched over HTTP by
   * MapLibre itself: only the document is kept, so a reload with no network draws land,
   * water and roads from the archive and **no names and no icons**. That is the honest
   * state of this renderer (L7, L14): names would need the font ranges and the sprite
   * sheet kept as well, and caching them is not what this module does.
   */
  style?: StyleSpecification;
  /** Size of the downloaded archive, for the UI and for tests. */
  bytes?: number;
  error?: string;
}

/** One registry per page: the protocol is global to MapLibre, the archives are not. */
const archives = new Map<string, PMTiles>();
const sizes = new Map<string, number>();
/** Keyed by style url: a style has its own version and changes without the archive. */
const styles = new Map<string, StyleSpecification>();
const headers = new Map<string, { minZoom: number; maxZoom: number; bounds: number[] }>();
let protocolRegistered = false;

function keyFor(url: string): string {
  return url.replace(/[^a-z0-9]+/gi, '-').slice(-48);
}

/**
 * Fetches a style document, failing loudly instead of handing back a partial one.
 * Returns undefined when no style is configured.
 *
 * The document travels through the client's cache (`map-style-cache.ts`, the L7
 * decision): a successful GET is written under `styleCacheKey(url)` and read back when
 * the request cannot answer, which is how a reload with no connectivity draws the style
 * it drew last time. The native renderer reads and writes the same key, so a device and
 * a browser cannot disagree about where a style lives.
 *
 * A first visit with no network and nothing stored behaves exactly as it did before: the
 * storage read finds nothing and the original fetch error is what surfaces. A body the
 * cache hands back without the `version` MapLibre reads first is absent, never a style
 * — the one rule both renderers apply, so a poisoned cache entry costs a retry instead
 * of a permanently blank map.
 */
async function fetchStyle(url?: string): Promise<StyleSpecification | undefined> {
  if (!url) return undefined;
  const document = await fetchStyleDocument(url);
  if (!isDrawableStyle<StyleSpecification>(document)) {
    throw new Error(`style ${url} is not a drawable document`);
  }
  return document;
}

/**
 * Fetches a configured style into the page registry, reusing the cached document.
 * Keyed by url, not by archive: the style can be republished while the archive stays.
 */
async function loadStyle(url: string): Promise<StyleSpecification> {
  const cached = styles.get(url);
  if (cached) return cached;
  const style = await fetchStyle(url);
  if (!style) throw new Error(`style ${url} did not return a document`);
  styles.set(url, style);
  return style;
}

/**
 * Downloads an archive (and its style, when configured) into the page registry.
 * Exported so it can be exercised directly, without mounting a component.
 */
async function loadArchive(archiveUrl: string, styleUrl?: string): Promise<MapSourceState> {
  // The style and the archive do not depend on each other: both are requested at once.
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
  if (style && styleUrl) styles.set(styleUrl, style);
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

/** Builds a ready state from the registry, the single source the render path reads. */
function readyState(key: string, style?: StyleSpecification): MapSourceState {
  return {
    status: 'ready',
    sourceUrl: `sonora://${key}`,
    bytes: sizes.get(key),
    ...(style ? { style } : {}),
  };
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
  const [result, setResult] = useState<{
    key: string;
    styleUrl?: string;
    state: MapSourceState;
  } | null>(null);
  const key = archiveUrl ? keyFor(archiveUrl) : null;

  useEffect(() => {
    if (!key || !archiveUrl) return;

    // Cancellation is per run, not shared: a url change cancels only the run it
    // started, so a stale download can never settle the state of the run that replaced it.
    let cancelled = false;

    const fail = (error: unknown) => {
      if (cancelled) return;
      setResult({
        key,
        styleUrl,
        state: {
          status: 'error',
          error: error instanceof Error ? error.message : 'archive download failed',
        },
      });
    };

    if (!archives.has(key)) {
      loadArchive(archiveUrl, styleUrl)
        .then((state) => {
          if (!cancelled) setResult({ key, styleUrl, state });
        })
        .catch(fail);
    } else if (styleUrl && !styles.has(styleUrl)) {
      // The archive is already in memory; only its new style document is missing.
      loadStyle(styleUrl)
        .then((style) => {
          if (!cancelled) setResult({ key, styleUrl, state: readyState(key, style) });
        })
        .catch(fail);
    }

    return () => {
      cancelled = true;
    };
  }, [archiveUrl, key, styleUrl]);

  if (!key) return { status: 'error', error: 'no archive configured' };
  const style = styleUrl ? styles.get(styleUrl) : undefined;
  if (archives.has(key) && (!styleUrl || style)) {
    return readyState(key, style);
  }
  if (result?.key === key && result.styleUrl === styleUrl) return result.state;
  return { status: 'loading' };
}
