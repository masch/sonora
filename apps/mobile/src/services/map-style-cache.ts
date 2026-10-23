import { ApiClient } from '@/services/api-client';
import { fingerprint } from '@/utils/fingerprint';

/**
 * The style document, on both platforms: one cache, one key rule, one answer to "is
 * this a document MapLibre can draw".
 *
 * A style is one JSON document. It used to be kept twice — the web renderer through
 * `ApiClient` with a `cacheKey` (T-E3) and the native renderer as a file under
 * `map-styles/` (T-E2) — which meant two keys, two failure modes, and two places that
 * had to agree about what a drawable body is. Nothing about the renderer changes which
 * bytes a url stands for, so the document goes through the client's cache everywhere
 * and the filesystem keeps only the binary assets MapLibre has to read as a real path
 * (`map-styles.ts`, the glyph ranges and the sprite).
 *
 * Both rules that used to live in the renderers live here instead: the storage key,
 * derived from the url and from nothing else, and the check that separates a style
 * document from a body that merely parsed.
 */

/** The one field every style carries and MapLibre refuses to draw without. */
export interface CachedStyleDocument {
  version: number;
  [member: string]: unknown;
}

/**
 * The storage key a style document is cached under: `map_style_cache_<fingerprint of url>`.
 *
 * Derived from the style url and from nothing else, so the same url always finds the same
 * bytes, on the phone and in the browser alike. The url changes exactly when the document
 * is republished (`…/styles/v1.json`), so a cached key never answers with a different
 * version's style — and because the whole url is fingerprinted, staging, production and a
 * local wrangler keep their documents apart instead of serving each other's cold start.
 *
 * The consequence, stated rather than hidden: when the payload starts naming a new style
 * version, the first load has to reach the network, and the superseded key stays in
 * storage as dead weight (one style document per published version, 268 KB each, L7).
 */
export function styleCacheKey(styleUrl: string): string {
  return `map_style_cache_${fingerprint(styleUrl)}`;
}

/**
 * Whether MapLibre could draw this document.
 *
 * `version` is the one field every style carries and the first one the renderer reads, so
 * a body without it — an error page some cache stored, a document a failed write left
 * behind — is not a style at all. Reporting it as absent is what lets the caller fail the
 * way it already fails instead of handing the map something it cannot render. One rule
 * for both platforms, so the two paths cannot disagree: the client's cache is filled by
 * whatever a 200 carried, and this is what decides whether that body may reach MapLibre.
 */
export function isDrawableStyle<T extends object = CachedStyleDocument>(
  document: unknown,
): document is T {
  return (
    document !== null &&
    typeof document === 'object' &&
    typeof (document as { version?: unknown }).version === 'number'
  );
}

/**
 * Fetches a style document through the client's cache, on whichever platform asks.
 *
 * Why through `ApiClient` and not a raw `fetch` (L7): the base client writes the body of a
 * successful GET to storage under its `cacheKey` and reads that storage back when the
 * request cannot answer. That is the offline fallback the experiences list already uses,
 * so a cold start with no connectivity draws the style it drew last time and no second
 * cache mechanism is written. The client accepts an absolute url, which is what a style
 * url is.
 *
 * A first visit with no network and nothing stored behaves exactly as it did before: the
 * storage read finds nothing and the original fetch error is what surfaces. The body is
 * returned untyped on purpose — the caller decides with {@link isDrawableStyle}, so no
 * renderer can hand the map a body that was never checked.
 *
 * `signal` is forwarded so a renderer that bounds its wait can cancel the transfer itself
 * rather than only walking away from it.
 */
export async function fetchStyleDocument(
  styleUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<unknown> {
  return ApiClient.get<unknown>(styleUrl, {
    cacheKey: styleCacheKey(styleUrl),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
