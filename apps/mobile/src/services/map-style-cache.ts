import { appStorage } from '@/storage/app-storage';
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
  return `map_style_cache_${fingerprint(styleIdentity(styleUrl))}`;
}

/**
 * The url without its query or its fragment.
 *
 * A style's identity is its origin and its path: `…/styles/v1.json` holds one document,
 * and a query — a cache buster a caller added, a retry marker — cannot change which
 * document that path is. Hashing the raw url meant a fetch that only succeeded on a
 * `?retry` attempt was stored under a key the next cold start never asked for, so the
 * walker who had the document on the phone still got a blank map.
 */
function styleIdentity(styleUrl: string): string {
  const withoutFragment = styleUrl.split('#')[0] ?? '';
  return withoutFragment.split('?')[0] ?? '';
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
 * The document kept for this url, if the device or the browser holds one MapLibre can
 * draw.
 *
 * A stored body that does not pass {@link isDrawableStyle} is reported as absent rather
 * than returned: an older build wrote whatever a 200 carried, and this read is where
 * such a document stops being able to blank the map.
 */
export async function readCachedStyleDocument(
  styleUrl: string,
): Promise<CachedStyleDocument | null> {
  try {
    const stored = await appStorage.getItem(styleCacheKey(styleUrl));
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    return isDrawableStyle(parsed) ? parsed : null;
  } catch {
    // Unreadable storage and unparsable bodies are the same answer here: nothing kept.
    return null;
  }
}

/**
 * Keeps a document the renderer actually accepted.
 *
 * Written after validation on purpose. The client's own `cacheKey` path stores the body
 * of any 2xx response before the caller can look at it, so a captive portal or an error
 * page served with 200 replaced the last good style and the next cold start had nothing
 * to draw. Only a document that passed {@link isDrawableStyle} is ever written here.
 */
async function writeCachedStyleDocument(
  styleUrl: string,
  document: CachedStyleDocument,
): Promise<void> {
  try {
    await appStorage.setItem(styleCacheKey(styleUrl), JSON.stringify(document));
  } catch {
    // Best effort: failing to keep the document only costs the next cold start.
  }
}

/**
 * Fetches a style document, keeping the client's transport and owning the cache.
 *
 * The request still goes through `ApiClient` (L7): the same transport, the same device
 * headers, the same error shape the rest of the app reads. What it does not use is the
 * client's `cacheKey`, because that path writes before anyone can validate — see
 * {@link writeCachedStyleDocument}. The cache is therefore this module's, on the same
 * storage (`appStorage`: SQLite on the phone, local storage in the browser) and under the
 * one key rule above, so both renderers agree about where the document lives and only a
 * drawable document is ever kept.
 *
 * A first visit with no network and nothing stored behaves exactly as it did before: the
 * read finds nothing and the original error is what surfaces. The body is returned
 * untyped on purpose — the caller decides with {@link isDrawableStyle}, so no renderer
 * can hand the map a body that was never checked.
 *
 * `signal` is forwarded so a renderer that bounds its wait can cancel the transfer itself
 * rather than only walking away from it.
 */
export async function fetchStyleDocument(
  styleUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<unknown> {
  try {
    const document = await ApiClient.get<unknown>(styleUrl, {
      skipCache: true,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (isDrawableStyle(document)) await writeCachedStyleDocument(styleUrl, document);
    return document;
  } catch (error) {
    // The request could not answer. What the device kept is the answer, if it can be
    // drawn; otherwise the original failure is what the walker's screen reports.
    const kept = await readCachedStyleDocument(styleUrl);
    if (kept) return kept;
    throw error;
  }
}
