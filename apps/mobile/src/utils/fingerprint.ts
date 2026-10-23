/**
 * The one fingerprint this app derives cache keys and file names from.
 *
 * FNV-1a over the whole value, as 8 lowercase hex digits. It has to be stable across
 * runs, devices and platforms: a key that changed between two launches would never find
 * the document or the file the previous launch wrote.
 *
 * It lives in one place because two copies of "the same" hash is the failure it is meant
 * to prevent — one of them drifting would silently orphan every cached archive and every
 * cached style, without an error anywhere. The users are the archive identity
 * (`map-archives.ts`, which fingerprints the host) and the style cache key
 * (`map-style-cache.ts`, which fingerprints the whole url).
 *
 * Deliberately not a cryptographic hash: these values name files and storage keys, they
 * do not authenticate anything, and a slow hash here would buy nothing.
 */
export function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
