import { useEffect, useState } from 'react';

import { Directory, File, FileMode, Paths } from 'expo-file-system';

/**
 * Resolves the base-map PMTiles archive to a file on the device.
 *
 * Why download instead of pointing MapLibre at the remote archive: MapLibre Native
 * reads PMTiles by byte ranges, and the API route that serves the bucket does not
 * answer them. `pmtiles://file://…` is the transport it does understand, and it is
 * the same file an offline pack needs, so nothing built here is thrown away later.
 */

export type MapArchiveFileStatus = 'loading' | 'ready' | 'error';

export interface MapArchiveFileState {
  status: MapArchiveFileStatus;
  /** `pmtiles://file://…` of the complete archive on disk. */
  uri?: string;
  /** Why the archive could not be resolved; the caller shows its error state. */
  error?: string;
}

/** Subdirectory of the document directory: the cache may be reclaimed, this may not. */
const ARCHIVE_DIRECTORY = 'map-archives';

/** Characters of the url kept readable at the end of the key: the `<version>.pmtiles` segment. */
const KEY_TAIL_LENGTH = 48;

/** The PMTiles format's first bytes: no archive starts with anything else. */
const PMTILES_MAGIC = 'PMTiles';

/** The only version this app reads; the header layout below is the v3 one. */
const PMTILES_VERSION = 3;

/** Bytes of a v3 header: magic, version byte, then the little-endian uint64 fields. */
const PMTILES_HEADER_LENGTH = 127;

/** Offsets of the two pairs this check needs, within the v3 header. */
const HEADER_ROOT_DIRECTORY_OFFSET = 8;
const HEADER_TILE_DATA_OFFSET = 56;

/** Distinguishes one run's temporary file from another's within this process. */
let runSequence = 0;

/**
 * Fingerprint of a string, as 8 lowercase hex digits: FNV-1a over the whole value,
 * so it is stable across runs, devices and platforms.
 */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Cache key of an archive: a fingerprint of the whole url, then its readable tail.
 *
 * The web renderer builds its key from the sanitised tail alone (`keyFor` in
 * `use-map-source.ts`), which is harmless there because that cache is the in-memory
 * `sonora://` protocol and dies with the page. This key names a file that survives
 * restarts, so the host has to be part of it: two hosts serving the same path —
 * staging and production, or an api host and a CDN — differ only before the tail,
 * and the second url would otherwise be answered with the first host's archive,
 * silently, without downloading. The tail stays readable and keeps the
 * `<version>.pmtiles` segment last, so a new version still lands on a new file and
 * an older one stays where it is.
 */
function archiveKey(archiveUrl: string): string {
  return `${fingerprint(archiveUrl)}-${readableTail(archiveUrl.replace(/[^a-z0-9]+/gi, '-'))}`;
}

/**
 * The end of the sanitised url, at most {@link KEY_TAIL_LENGTH} characters and cut
 * on a segment boundary so the readable part never starts mid-word.
 */
function readableTail(sanitised: string): string {
  if (sanitised.length <= KEY_TAIL_LENGTH) return sanitised;
  const cut = sanitised.length - KEY_TAIL_LENGTH;
  const boundary = sanitised.indexOf('-', cut);
  return boundary === -1 ? sanitised.slice(cut) : sanitised.slice(boundary + 1);
}

/**
 * The url to fetch. The configured value may already carry the `pmtiles://`
 * transport scheme, which belongs to MapLibre and means nothing to the network.
 */
function remoteUrl(archiveUrl: string): string {
  return archiveUrl.replace(/^pmtiles:\/\//, '');
}

/**
 * Name of one run's temporary file. Every run gets its own, so two mounts of the
 * same archive never download into, or delete, each other's file; publication is
 * still a single move onto the one final name, which is what makes it atomic. A
 * deterministic `<archive>.part` name made the runs interfere: the second mount
 * deleted the first's transfer and then published a file the first was still
 * writing.
 *
 * The timestamp and the counter are both monotonic within this process, which is
 * all the separation needed: no run can reuse another's name. Deliberately no
 * randomness — a weak random token in a file that writes archives is what the
 * doctor reports as weak cryptography, and crypto-grade randomness would buy
 * nothing here.
 */
function temporaryName(archiveName: string): string {
  runSequence += 1;
  return `${archiveName}.${Date.now()}-${runSequence}.part`;
}

/**
 * The first bytes of a file. Only the magic and the header are read, never the whole
 * archive: the directory and the tiles belong to the reader, and loading a full
 * region archive into memory to look at its header would be its own failure.
 */
async function leadingBytes(file: File, length: number): Promise<Uint8Array> {
  const handle = file.open(FileMode.ReadOnly);
  try {
    return handle.readBytes(length);
  } finally {
    handle.close();
  }
}

/**
 * One little-endian uint64 of the header: the two uint32 halves the format stores.
 * 32-bit arithmetic stays exact far past any archive this app can hold.
 */
function uint64(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);
  return low + high * 2 ** 32;
}

/**
 * Rejects a transfer that did not deliver a PMTiles v3 archive.
 *
 * The magic alone is not enough: a download cut short still starts with `PMTiles`,
 * and published under the archive's name it is read on every later mount without
 * being checked again, so the map never recovers from it. The header is therefore
 * read once here, while publishing, and the two ranges it promises — the root
 * directory and the tile data — have to end inside the file. Publication is what
 * makes the archive trustworthy; the reuse path stays a plain `exists` check.
 */
async function assertArchive(temporary: File): Promise<void> {
  const fileSize = temporary.size;
  if (fileSize === 0) throw new Error('downloaded archive is empty');

  const header = await leadingBytes(temporary, PMTILES_HEADER_LENGTH);
  const magic = String.fromCharCode(...header.subarray(0, PMTILES_MAGIC.length));
  if (magic !== PMTILES_MAGIC) throw new Error('downloaded archive is not a PMTiles archive');
  // Too short to hold a header at all: the rest of it cannot be trusted.
  if (header.length < PMTILES_HEADER_LENGTH) throw new Error('downloaded archive is truncated');
  if (header[PMTILES_MAGIC.length] !== PMTILES_VERSION) {
    throw new Error('downloaded archive has an unsupported PMTiles version');
  }

  // The root directory and the tile data are all a reader has to reach; an archive
  // that promises either past its own end is a truncated download.
  const rootDirectoryEnd =
    uint64(header, HEADER_ROOT_DIRECTORY_OFFSET) + uint64(header, HEADER_ROOT_DIRECTORY_OFFSET + 8);
  const tileDataEnd =
    uint64(header, HEADER_TILE_DATA_OFFSET) + uint64(header, HEADER_TILE_DATA_OFFSET + 8);
  if (rootDirectoryEnd > fileSize || tileDataEnd > fileSize) {
    throw new Error('downloaded archive is truncated');
  }
}

/** Drops one run's temporary file, so a failed run releases the space it took. */
function discardTemporary(temporary: File): void {
  try {
    if (temporary.exists) temporary.delete();
  } catch {
    // Why the archive could not be published is what the caller has to see, so a
    // cleanup that fails itself may not replace that error.
  }
}

/**
 * Downloads the archive for `archiveUrl` to its versioned path, or reuses the file
 * already there.
 *
 * The transfer lands on a temporary file unique to this run, is checked to be a
 * PMTiles v3 archive that holds every byte it promises, and only then replaces the
 * archive in one move: on Android the response streams straight into the
 * destination, so a failed download can leave a partial file, and a truncated
 * archive would break every read that follows. Every way of failing — a transfer
 * error, a body that is not a whole archive, a move that cannot land — releases the
 * temporary. An archive of another version is never deleted: it is what the map
 * keeps drawing when the new one cannot be fetched.
 */
async function downloadArchive(archiveUrl: string): Promise<string> {
  const url = remoteUrl(archiveUrl);
  const directory = new Directory(Paths.document, ARCHIVE_DIRECTORY);
  directory.create({ idempotent: true, intermediates: true });

  const archive = new File(directory, `${archiveKey(url)}.pmtiles`);
  if (archive.exists) return `pmtiles://${archive.uri}`;

  const temporary = new File(directory, temporaryName(archive.name));
  try {
    await File.downloadFileAsync(url, temporary);
    await assertArchive(temporary);
    await temporary.move(archive, { overwrite: true });
  } catch (error) {
    discardTemporary(temporary);
    throw error;
  }

  return `pmtiles://${archive.uri}`;
}

/**
 * The archive the native map source points at, as a `pmtiles://file://…` uri.
 *
 * @param archiveUrl the archive the map config carries, with or without the
 *                   `pmtiles://` scheme, or undefined when none is configured.
 */
export function useMapArchiveFile(archiveUrl: string | undefined): MapArchiveFileState {
  const [settled, setSettled] = useState<{ key: string; value: MapArchiveFileState } | null>(null);
  const key = archiveUrl ? archiveKey(remoteUrl(archiveUrl)) : null;

  useEffect(() => {
    if (!archiveUrl || !key) return;

    // Cancellation is per run: a url change cancels only the run it started, so an
    // abandoned download can never settle the state of the run that replaced it.
    let cancelled = false;

    downloadArchive(archiveUrl)
      .then((uri) => {
        if (!cancelled) setSettled({ key, value: { status: 'ready', uri } });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSettled({
          key,
          value: {
            status: 'error',
            error: error instanceof Error ? error.message : 'archive download failed',
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [archiveUrl, key]);

  if (!key) return { status: 'error', error: 'no archive configured' };
  // A settled result for another archive says nothing about this one.
  if (settled?.key === key) return settled.value;
  return { status: 'loading' };
}
