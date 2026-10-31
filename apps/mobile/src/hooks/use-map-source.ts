import { useEffect, useState } from 'react';

import type { StyleSpecification } from 'maplibre-gl';
import { PMTiles } from 'pmtiles';

import { fetchStyleDocument, isDrawableStyle } from '@/services/map-style-cache';
import { logger } from '@/utils/logger';

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

/**
 * Why a run failed, as a stable code.
 *
 * The native renderer translates the codes its waits report (`ERROR_MESSAGE_KEYS` in
 * `experience-map.tsx`), and this is the same kind of answer: the stage that failed, not
 * the sentence a request or the filesystem produced. The detail stays in the log.
 */
export type MapSourceErrorCode =
  'archiveMissing' | 'archiveDownloadFailed' | 'styleRequestFailed' | 'styleInvalid';

/**
 * A failure that carries the code the screen translates, and the detail the log keeps.
 *
 * `detail` is whatever the request layer produced — the status line of a 404, the error
 * a browser threw, the body that was not a style — and it never reaches the screen.
 */
class MapSourceFailure extends Error {
  constructor(
    readonly code: MapSourceErrorCode,
    readonly detail: unknown,
  ) {
    super(code);
    this.name = 'MapSourceFailure';
  }
}

/** The code a failed run reports; a throw that named none is an archive download failure. */
function failureCode(error: unknown): MapSourceErrorCode {
  return error instanceof MapSourceFailure ? error.code : 'archiveDownloadFailed';
}

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
  /** The stable code of a failed run, translated where the screen shows it. */
  error?: MapSourceErrorCode;
}

/** One registry per page: the protocol is global to MapLibre, the archives are not. */
const archives = new Map<string, PMTiles>();
const sizes = new Map<string, number>();
/** Keyed by style url: a style has its own version and changes without the archive. */
const styles = new Map<string, StyleSpecification>();
/**
 * Style transfers in flight, keyed by style url.
 *
 * A restarted run joins the transfer the page already has instead of starting a second
 * one: the style that was still arriving when the archive failed is the same document the
 * new run wants, so restarting the archive must not throw it away.
 */
const styleTransfers = new Map<string, Promise<StyleSpecification | undefined>>();
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

  let document: unknown;
  try {
    document = await fetchStyleDocument(url);
  } catch (error) {
    // The request could not answer: the detail is the log's business and the code is what
    // the screen translates.
    throw new MapSourceFailure('styleRequestFailed', error);
  }
  if (!isDrawableStyle<StyleSpecification>(document)) {
    throw new MapSourceFailure(
      'styleInvalid',
      new Error(`style ${url} is not a drawable document`),
    );
  }
  return document;
}

/**
 * The style this run draws: the page's document for `url`, the transfer already in flight
 * for it, or a fresh one — kept the moment it lands.
 *
 * Kept as soon as it resolves rather than when the archive it travels with settles: a
 * retry after an archive failure then reuses the document that already loaded instead of
 * paying for the same request twice.
 */
async function styleFor(url?: string): Promise<StyleSpecification | undefined> {
  if (!url) return undefined;
  const cached = styles.get(url);
  if (cached) return cached;

  const inFlight = styleTransfers.get(url);
  if (inFlight) return inFlight;

  const transfer = fetchStyle(url).then((style) => {
    if (style) styles.set(url, style);
    return style;
  });
  styleTransfers.set(url, transfer);

  try {
    return await transfer;
  } finally {
    // A newer transfer of the same url may already have replaced this entry.
    if (styleTransfers.get(url) === transfer) styleTransfers.delete(url);
  }
}

/**
 * One whole download of the archive, as a response or as a coded failure.
 *
 * The status line a server answered with is not a sentence for a walker to read, so it
 * travels in the failure's detail — where the log keeps it — and not in the state.
 */
async function downloadArchive(archiveUrl: string): Promise<Response> {
  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new MapSourceFailure(
      'archiveDownloadFailed',
      new Error(`${response.status} ${response.statusText}`),
    );
  }
  return response;
}

/**
 * Downloads an archive (and its style, when configured) into the page registry.
 * Exported so it can be exercised directly, without mounting a component.
 */
async function loadArchive(archiveUrl: string, styleUrl?: string): Promise<MapSourceState> {
  // The style and the archive do not depend on each other: both are requested at once.
  const [response, style] = await Promise.all([downloadArchive(archiveUrl), styleFor(styleUrl)]);

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
 * @param attempt    which run this is: a retry starts the load over, and a settled result
 *                   belongs to the run that produced it, never to the run that replaced
 *                   it. The waits that already settled are reused, so a restart costs
 *                   only what really has to be asked for again.
 */
export function useMapSource(
  archiveUrl: string | undefined,
  styleUrl?: string,
  attempt = 0,
): MapSourceState {
  // The status is derived from the registry, so the effect never has to reset it.
  const [result, setResult] = useState<{
    key: string;
    styleUrl?: string;
    attempt: number;
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
      const code = failureCode(error);
      // The detail a request or the filesystem produced stays here; the screen only ever
      // receives the code, which it translates.
      logger.warn(
        `map source failed (${code})`,
        error instanceof MapSourceFailure ? error.detail : error,
      );
      setResult({ key, styleUrl, attempt, state: { status: 'error', error: code } });
    };

    if (!archives.has(key)) {
      loadArchive(archiveUrl, styleUrl)
        .then((state) => {
          if (!cancelled) setResult({ key, styleUrl, attempt, state });
        })
        .catch(fail);
    } else if (styleUrl && !styles.has(styleUrl)) {
      // The archive is already in memory; only its new style document is missing.
      styleFor(styleUrl)
        .then((style) => {
          if (!cancelled) setResult({ key, styleUrl, attempt, state: readyState(key, style) });
        })
        .catch(fail);
    }

    return () => {
      cancelled = true;
    };
  }, [archiveUrl, key, styleUrl, attempt]);

  if (!key) return { status: 'error', error: 'archiveMissing' };
  const style = styleUrl ? styles.get(styleUrl) : undefined;
  if (archives.has(key) && (!styleUrl || style)) {
    return readyState(key, style);
  }
  // A settled result for another archive — or for another attempt of this one — says
  // nothing about this run.
  if (result?.key === key && result.styleUrl === styleUrl && result.attempt === attempt) {
    return result.state;
  }
  return { status: 'loading' };
}
