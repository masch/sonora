import { Directory, File, FileMode, Paths } from 'expo-file-system';

import {
  archiveFileName,
  listArchives,
  planEviction,
  type ArchiveIdentity,
  type StoredArchive,
} from '@/services/map-archives';
import { logger } from '@/utils/logger';

/**
 * The archive transfer: one region archive, on the device, or the reason it is not.
 *
 * Why download instead of pointing MapLibre at the remote archive: MapLibre Native
 * reads PMTiles by byte ranges, and the API route that serves the bucket does not
 * answer them. `pmtiles://file://…` is the transport it does understand, and it is
 * the same file an offline pack needs, so nothing built here is thrown away later.
 *
 * Kept out of the hook that uses it so the startup prefetch can download a region no
 * screen is showing, with the same validation and the same budget.
 */

export type MapArchiveErrorCode =
  | 'archiveMissing'
  | 'archiveDownloadFailed'
  | 'archivePublishFailed'
  | 'archiveEmpty'
  | 'archiveNotPmtiles'
  | 'archiveTruncated'
  | 'archiveVersionUnsupported';

/**
 * A transfer that cannot be published, named by the code the view translates. The
 * underlying platform error is logged where it happens: the log keeps the detail and
 * the screen keeps a message we authored.
 */
class ArchiveFailure extends Error {
  readonly code: MapArchiveErrorCode;

  constructor(code: MapArchiveErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Subdirectory of the document directory: the cache may be reclaimed, this may not. */
const ARCHIVE_DIRECTORY = 'map-archives';

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
 * How old a temporary file has to be before it is treated as a killed run's
 * leftover: a transfer of an archive this app can hold finishes well inside an hour,
 * and a temporary younger than that may belong to a run that is still writing.
 */
export const STALE_TEMPORARY_MS = 60 * 60 * 1000;

/**
 * The `Date.now()` a temporary's name carries, or null when the name is not one of
 * ours. A temporary is `<archive>.<timestamp>-<sequence>.part`, so the timestamp
 * comes from the name and no modification-time API is needed.
 */
const TEMPORARY_NAME = /\.(\d+)-\d+\.part$/;

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
 * nothing here. The timestamp is also what lets a later run tell this transfer
 * from the leftover of one that was killed: see {@link sweepStaleTemporaries}.
 */
function temporaryName(archiveName: string): string {
  runSequence += 1;
  return `${archiveName}.${Date.now()}-${runSequence}.part`;
}

/** The start time a temporary file's name announces, or null if it names no temporary. */
function temporaryStartedAt(name: string): number | null {
  const timestamp = TEMPORARY_NAME.exec(name)?.[1];
  if (timestamp === undefined) return null;
  const startedAt = Number(timestamp);
  return Number.isSafeInteger(startedAt) ? startedAt : null;
}

/**
 * Deletes the temporaries a killed process left in the archive directory.
 *
 * Every run downloads into its own temporary and publishes in one move, so a process
 * that dies mid-transfer leaves that file behind forever: nothing else would ever
 * name it again. The timestamp in the name is the only evidence of its age, and it
 * is enough — an hour-old temporary cannot belong to a transfer that is still
 * running, while a recent one may, and deleting a live run's file would break the
 * concurrency the per-run name exists for. The sweep is not scoped to the archive
 * being fetched, because the leftover belongs to whichever process died.
 *
 * It is best effort by design: this is housekeeping in front of a download that has
 * to happen anyway, so a listing or a deletion that fails is logged and never
 * reaches the caller.
 */
async function sweepStaleTemporaries(directory: Directory): Promise<void> {
  let entries: (Directory | File)[];
  try {
    entries = directory.list();
  } catch (error) {
    logger.warn('map archive sweep could not read the archive directory', error);
    return;
  }

  const now = Date.now();
  for (const entry of entries) {
    // Directories and anything that does not carry our pattern are never touched: an
    // archive of another version is what the map still draws, and it is not a leak.
    if (!(entry instanceof File)) continue;
    const startedAt = temporaryStartedAt(entry.name);
    if (startedAt === null || now - startedAt <= STALE_TEMPORARY_MS) continue;
    try {
      entry.delete();
    } catch (error) {
      logger.warn('map archive sweep could not delete a stale temporary', error);
    }
  }
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
  if (fileSize === 0) throw new ArchiveFailure('archiveEmpty');

  const header = await leadingBytes(temporary, PMTILES_HEADER_LENGTH);
  const magic = String.fromCharCode(...header.subarray(0, PMTILES_MAGIC.length));
  if (magic !== PMTILES_MAGIC) throw new ArchiveFailure('archiveNotPmtiles');
  // Too short to hold a header at all: the rest of it cannot be trusted.
  if (header.length < PMTILES_HEADER_LENGTH) throw new ArchiveFailure('archiveTruncated');
  if (header[PMTILES_MAGIC.length] !== PMTILES_VERSION) {
    throw new ArchiveFailure('archiveVersionUnsupported');
  }

  // The root directory and the tile data are all a reader has to reach; an archive
  // that promises either past its own end is a truncated download.
  const rootDirectoryEnd =
    uint64(header, HEADER_ROOT_DIRECTORY_OFFSET) + uint64(header, HEADER_ROOT_DIRECTORY_OFFSET + 8);
  const tileDataEnd =
    uint64(header, HEADER_TILE_DATA_OFFSET) + uint64(header, HEADER_TILE_DATA_OFFSET + 8);
  if (rootDirectoryEnd > fileSize || tileDataEnd > fileSize) {
    throw new ArchiveFailure('archiveTruncated');
  }
}

/**
 * The code a failed run reports: ours when it is one, otherwise a transfer failure.
 * The platform's own message never leaves the log.
 */
export function archiveErrorCode(error: unknown): MapArchiveErrorCode {
  return error instanceof ArchiveFailure ? error.code : 'archiveDownloadFailed';
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
export async function ensureArchiveOnDisk({
  archiveUrl,
  identity,
  cacheMaxBytes,
}: {
  archiveUrl: string;
  identity: ArchiveIdentity;
  /** Budget the archives may occupy; absent means the caller does not police it. */
  cacheMaxBytes?: number;
}): Promise<string> {
  const url = remoteUrl(archiveUrl);
  const directory = new Directory(Paths.document, ARCHIVE_DIRECTORY);
  directory.create({ idempotent: true, intermediates: true });

  const archive = new File(directory, archiveFileName(identity));
  if (archive.exists) return `pmtiles://${archive.uri}`;

  // Before this run adds a temporary of its own, release the ones dead runs left.
  await sweepStaleTemporaries(directory);
  if (cacheMaxBytes !== undefined) enforceBudget(directory, cacheMaxBytes, archive.name);

  const temporary = new File(directory, temporaryName(archive.name));
  try {
    await File.downloadFileAsync(url, temporary);
    await assertArchive(temporary);
  } catch (error) {
    discardTemporary(temporary);
    if (error instanceof ArchiveFailure) throw error;
    // The platform's own message stays in the log: the view only ever shows a code.
    logger.warn('map archive could not be downloaded', error);
    throw new ArchiveFailure('archiveDownloadFailed');
  }

  try {
    await temporary.move(archive, { overwrite: true });
  } catch (error) {
    // Out of space or out of permissions, discovered only when the file lands: the
    // transfer itself was fine, so this is not reported as a download failure.
    discardTemporary(temporary);
    logger.warn('map archive could not be published', error);
    throw new ArchiveFailure('archivePublishFailed');
  }

  return `pmtiles://${archive.uri}`;
}

/**
 * The archives this app has already downloaded.
 *
 * A prefetch asks this before it prices anything: an archive that is already on the
 * device costs nothing to "download" again, so it must not appear in the asking
 * total. A directory that cannot be listed is reported as empty — the prefetch then
 * prices everything, downloads over the files that exist, and reuses them.
 */
export function listDownloadedArchives(): StoredArchive[] {
  const directory = new Directory(Paths.document, ARCHIVE_DIRECTORY);
  let entries: (Directory | File)[];
  try {
    entries = directory.list();
  } catch (error) {
    logger.warn('map archive listing failed', error);
    return [];
  }

  return listArchives(
    entries
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => ({
        name: file.name,
        size: file.size,
        modificationTime: file.modificationTime ?? undefined,
      })),
  );
}

/**
 * Brings the archive directory back under `maxBytes` before another transfer starts.
 *
 * Best effort, like the sweep: the download in front of it has to happen either way,
 * and a file that cannot be deleted (another process holds it, the listing failed) is
 * logged rather than turned into a download failure. The archive being fetched is
 * never a candidate: it is the one this run is about to write.
 */
function enforceBudget(directory: Directory, maxBytes: number, keep: string): void {
  let entries: (Directory | File)[];
  try {
    entries = directory.list();
  } catch (error) {
    logger.warn('map archive budget could not read the archive directory', error);
    return;
  }

  const archives = listArchives(
    entries
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => ({
        name: file.name,
        size: file.size,
        modificationTime: file.modificationTime ?? undefined,
      })),
  );

  for (const name of planEviction({ archives, maxBytes, keep: [keep] })) {
    try {
      new File(directory, name).delete();
    } catch (error) {
      logger.warn('map archive could not be evicted', error);
    }
  }
}
