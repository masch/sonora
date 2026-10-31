import { fingerprint } from '@/utils/fingerprint';

/**
 * Identity and lifetime of the map archives on the device.
 *
 * Everything here is pure: the caller lists the directory and passes what the
 * filesystem reported, so the rules that decide which file an archive lives in and
 * which file may be deleted are testable without a device and without a mock.
 */

/** What identifies one published archive. */
export interface ArchiveIdentity {
  /** Region key the catalog publishes, e.g. `osm-calamuchita`. */
  region: string;
  /** Artifact version the environment names, e.g. `v1`. */
  version: string;
  /** Fingerprint of the host that served it, so two environments never share a file. */
  origin: string;
}

/** An archive this app wrote, as the filesystem describes it. */
export interface StoredArchive extends ArchiveIdentity {
  name: string;
  bytes: number;
  /** The platform's file timestamp, absent on a filesystem that does not report one. */
  modificationTime?: number;
}

/** The part of a directory entry this module needs. */
export interface DiskEntry {
  name: string;
  size: number;
  modificationTime?: number;
}

/** What the payload says one archive should be. */
export interface ExpectedArchive {
  /** The file name the payload's identity resolves to. */
  name: string;
  /**
   * The bytes the payload advertises for the region. Absent, or zero, means the
   * payload priced nothing — the name is then the only evidence there is.
   */
  bytes?: number;
}

/** Extension every archive file carries; the transport scheme belongs to MapLibre. */
const ARCHIVE_EXTENSION = '.pmtiles';

/**
 * A file this module wrote: `<region>-<version>-<origin>.pmtiles`.
 *
 * The region comes first and may itself contain dashes, so the version is the one
 * segment left between the region and the fixed-width origin fingerprint.
 */
const ARCHIVE_NAME = /^(.+)-([^-/]+)-([0-9a-f]{8})\.pmtiles$/;

/** The version segment of a url the shared generator built: `…/<version>.pmtiles`. */
const URL_VERSION = /([^/]+)\.pmtiles(?:\?.*)?$/;

/** Scheme, host and port of an absolute url. */
const URL_ORIGIN = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)/i;

/**
 * The host an archive came from.
 *
 * Staging, production, a CDN or a local wrangler can publish the same region at the
 * same version, and their bytes are not interchangeable, so the host is part of the
 * file's identity. A url without an origin is fingerprinted whole: the app never
 * builds one, and a wrong-but-stable key only costs a re-download.
 */
function originOf(url: string): string {
  return fingerprint(URL_ORIGIN.exec(url)?.[1] ?? url);
}

/**
 * The identity of the archive a map source points at, or null when there is none.
 *
 * A map in no region has nothing to download, and a url that does not end in the
 * version segment the shared generator writes cannot be keyed by version at all —
 * both are reported as absent instead of being given a key nobody can reason about.
 */
export function archiveIdentity(
  archiveUrl: string | undefined | null,
  regionKey: string | undefined | null,
): ArchiveIdentity | null {
  if (!archiveUrl || !regionKey) return null;

  const url = archiveUrl.replace(/^pmtiles:\/\//, '');
  const version = URL_VERSION.exec(url)?.[1];
  // A version carrying a dash would be indistinguishable from the region on the way
  // back, so such a url is not treated as one of ours.
  if (!version || version.includes('-')) return null;

  return { region: regionKey, version, origin: originOf(url) };
}

/** The file an identity lives in. */
export function archiveFileName(identity: ArchiveIdentity): string {
  return `${identity.region}-${identity.version}-${identity.origin}${ARCHIVE_EXTENSION}`;
}

/** The identity a file name announces, or null for anything this app did not write. */
export function parseArchiveFileName(name: string): ArchiveIdentity | null {
  const match = ARCHIVE_NAME.exec(name);
  if (!match) return null;
  const [, region, version, origin] = match;
  return { region, version, origin };
}

/**
 * The archives on disk, out of whatever the directory lists.
 *
 * Temporaries of a killed run, files of another app, and anything else that does not
 * carry our name are left out: they are not archives, and eviction must not reason
 * about them.
 */
export function listArchives(entries: readonly DiskEntry[]): StoredArchive[] {
  const archives: StoredArchive[] = [];
  for (const entry of entries) {
    const identity = parseArchiveFileName(entry.name);
    if (!identity) continue;
    archives.push({
      ...identity,
      name: entry.name,
      bytes: entry.size,
      modificationTime: entry.modificationTime,
    });
  }
  return archives;
}

/**
 * Whether the archive on the device is still the one the payload publishes.
 *
 * The file's identity is its name — region, version and origin — and the version is
 * already in that name, so the name says which artifact this is but nothing about
 * whether it is still the artifact the server holds now. Staging replaces a published
 * archive in place: `<region>-<version>-<origin>.pmtiles` keeps its name while the
 * bytes underneath change, and a check that trusted the name alone left the walker
 * drawing the artifact the payload had already replaced. The size the payload
 * advertises is the one signal the device can compare on every mount without reading
 * the archive, so a file of another size is treated as another archive and fetched
 * again.
 *
 * A payload that names no size — a region the server priced at zero, or a shape this
 * build does not understand — leaves the name as the whole answer, which is the check
 * this was before sizes were compared: an archive named right is never downloaded
 * again for no reason. An absent archive is never current, whatever the payload says.
 */
export function isArchiveCurrent(
  archive: StoredArchive | null | undefined,
  expected: ExpectedArchive,
): boolean {
  if (!archive || archive.name !== expected.name) return false;
  // Zero bytes is a price nobody gave, not an archive of no content.
  if (!expected.bytes) return true;
  return archive.bytes === expected.bytes;
}

/**
 * Oldest first: an archive the filesystem did not timestamp is the oldest there is,
 * and ties are broken by name so the plan is the same on every run.
 */
function oldestFirst(left: StoredArchive, right: StoredArchive): number {
  const leftTime = left.modificationTime ?? Number.NEGATIVE_INFINITY;
  const rightTime = right.modificationTime ?? Number.NEGATIVE_INFINITY;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.name.localeCompare(right.name);
}

/**
 * Which archives have to go for the directory to fit `maxBytes`, oldest first.
 *
 * `keep` names the archives in use right now: a map the walker has open may not lose
 * the file it is drawing, so it survives even when that leaves the directory over
 * budget. The result is a plan, not a deletion: the caller deletes and can log
 * whatever fails.
 *
 * Recency is the file's own timestamp — when it was last written, which for an
 * archive this app only writes once is when it was downloaded. Nothing is touched on
 * read, so the order is "least recently downloaded", and it is called that instead
 * of pretending a use marker exists.
 */
export function planEviction({
  archives,
  maxBytes,
  keep = [],
}: {
  archives: readonly StoredArchive[];
  maxBytes: number;
  keep?: readonly string[];
}): string[] {
  const protectedNames = new Set(keep);
  let total = archives.reduce((sum, archive) => sum + archive.bytes, 0);
  if (total <= maxBytes) return [];

  const candidates = archives
    .filter((archive) => !protectedNames.has(archive.name))
    .sort(oldestFirst);

  const evicted: string[] = [];
  for (const candidate of candidates) {
    if (total <= maxBytes) break;
    total -= candidate.bytes;
    evicted.push(candidate.name);
  }
  return evicted;
}
