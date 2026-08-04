/**
 * Shared log-redaction policy for the API.
 *
 * Sole source of truth for what may appear in logs: the header allowlist, the
 * query-param allowlist, the safe body-field allowlist, and URL sanitization.
 * No call site MAY implement ad-hoc redaction outside this helper.
 */

export const HEADER_ALLOWLIST = new Set(['content-type', 'user-agent', 'x-request-id']);

export const QUERY_ALLOWLIST = new Set(['page', 'limit', 'sync']);

export const BODY_FIELD_ALLOWLIST = new Set([
  'purchaseId',
  'status',
  'event',
  'providerPaymentId',
  'merchant_order_id',
  'externalReference',
  'type',
]);

export const UNPARSEABLE_URL = '<unparseable>';
export const UNPARSEABLE_BODY = '<unparseable-body>';

/**
 * Returns the URL with the query string (and hash) removed: origin + path for
 * absolute URLs, scheme + host + path for custom schemes, path only for
 * relative strings. Unparseable input reduces to `UNPARSEABLE_URL`, never the
 * raw input.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url); // absolute (http/https OR custom scheme)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.origin}${parsed.pathname}`; // origin+path; query+hash+userinfo dropped
    }
    // Custom scheme (e.g. sonora://app/return/success/uuid): keep scheme+host+path
    return parsed.host
      ? `${parsed.protocol}//${parsed.host}${parsed.pathname}`
      : `${parsed.protocol}${parsed.pathname}`;
  } catch {
    // Not absolute: relative path or garbage
    const stripped = url.split('?')[0].split('#')[0];
    return url.startsWith('/') ? stripped : UNPARSEABLE_URL;
  }
}

/**
 * Returns only the allowlisted headers, matched case-insensitively, with
 * canonical-lowercase keys.
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (HEADER_ALLOWLIST.has(lower)) out[lower] = value;
  }
  return out;
}

/**
 * Returns only explicitly allowlisted top-level body fields. Nested fields are
 * never extracted; non-scalar values at allowlisted keys become `<object>` /
 * `<array>` type markers.
 */
export function extractSafeBodyFields(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, unknown> = {};
  for (const key of BODY_FIELD_ALLOWLIST) {
    if (!(key in body)) continue;
    const value = (body as Record<string, unknown>)[key];
    out[key] =
      typeof value === 'object' && value !== null
        ? Array.isArray(value)
          ? '<array>'
          : '<object>'
        : value;
  }
  return out;
}

/**
 * Returns only the allowlisted query params: exactly `page`, `limit`, `sync`.
 */
export function sanitizeQuery(query: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (QUERY_ALLOWLIST.has(key)) out[key] = value;
  }
  return out;
}
