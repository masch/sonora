import {
  DEFAULT_REMOTE_CONFIG,
  isAllowedHttpsUrl,
  MAP_LINK_ALLOWED_HOSTS,
  type MapDocument,
} from '@sonora/shared';

/**
 * The rules a reference document must pass before it is stored.
 *
 * They live here, not inside the write route, because there are two write paths: the
 * admin endpoint and the staging seed. A rule that only one of them applies is a rule
 * with a hole — a document the API rejects would be seeded happily, and the two paths
 * would disagree about what a publishable reference is.
 *
 * Deliberately not in `@sonora/shared`: nothing outside this app calls these. The shared
 * package keeps the rule's *data* (`MAP_LINK_ALLOWED_HOSTS`, `isAllowedHttpsUrl`), which
 * the client needs to decide whether to render a card button; the write-side verdict is
 * the server's alone.
 */

/**
 * Returns a human-readable reason when a card link may not be published: the host must
 * be allowlisted, the URL https, and an Instagram link must point at our own profile
 * rather than at someone else's.
 */
export function linkRejectionReason(document: MapDocument): string | null {
  const handle = DEFAULT_REMOTE_CONFIG.social?.instagramHandle;

  for (const feature of document.collection.features) {
    const { linkUrl } = feature.properties;
    if (!linkUrl) continue;

    if (!isAllowedHttpsUrl(linkUrl, MAP_LINK_ALLOWED_HOSTS)) {
      return `link host is not allowlisted: ${linkUrl}`;
    }

    const parsed = new URL(linkUrl);
    if (
      handle &&
      (parsed.hostname === 'instagram.com' || parsed.hostname.endsWith('.instagram.com'))
    ) {
      const expected = `/${handle}`;
      if (parsed.pathname.replace(/\/$/, '') !== expected) {
        return `instagram links must point to ${expected}`;
      }
    }
  }

  return null;
}

/**
 * Returns a reason when a card image did not come from our upload endpoint.
 *
 * `expectedOrigin` is the origin the document will be served from. A caller that has a
 * request — the write route — always passes it. A caller that does not — the seed, which
 * runs against a database before an origin is chosen — passes nothing, and the path rule
 * is still enforced: the image must come from our upload route even when which host
 * serves it is not yet decided.
 */
export function imageRejectionReason(
  document: MapDocument,
  expectedOrigin?: string,
): string | null {
  for (const feature of document.collection.features) {
    const { imageUrl } = feature.properties;
    if (!imageUrl) continue;

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return `invalid image url: ${imageUrl}`;
    }

    if (!parsed.pathname.startsWith('/media/public/')) {
      return `image urls must come from the upload endpoint: ${imageUrl}`;
    }
    if (expectedOrigin !== undefined && parsed.origin !== expectedOrigin) {
      return `image urls must come from the upload endpoint on this origin: ${imageUrl}`;
    }
  }

  return null;
}
