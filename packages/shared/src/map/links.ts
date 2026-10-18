/**
 * Hosts a reference card may link to. The list is intentionally small and
 * lives in one place: extend it here instead of scattering URL checks.
 */
export const MAP_LINK_ALLOWED_HOSTS = ['openstreetmap.org', 'instagram.com'] as const;

/**
 * True when `value` is an https URL whose host is an allowed host or one of
 * its subdomains. Plain http, other hosts, look-alike suffixes and malformed
 * values are rejected.
 */
export function isAllowedHttpsUrl(
  value: string,
  allowedHosts: readonly string[] = MAP_LINK_ALLOWED_HOSTS,
): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
