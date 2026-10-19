import { useEffect, useState } from 'react';

import { Directory, File, Paths } from 'expo-file-system';

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
 * Downloads the archive for `archiveUrl` to its versioned path, or reuses the file
 * already there.
 *
 * The transfer lands on a `.part` file and only replaces the archive once it has
 * completed: on Android the response streams straight into the destination, so a
 * failed download can leave a partial file, and a truncated archive would break
 * every read that follows. An archive of another version is never deleted — it is
 * what the map keeps drawing when the new one cannot be fetched.
 */
async function downloadArchive(archiveUrl: string): Promise<string> {
  const url = remoteUrl(archiveUrl);
  const directory = new Directory(Paths.document, ARCHIVE_DIRECTORY);
  directory.create({ idempotent: true, intermediates: true });

  const archive = new File(directory, `${archiveKey(url)}.pmtiles`);
  if (archive.exists) return `pmtiles://${archive.uri}`;

  const partial = new File(directory, `${archive.name}.part`);
  if (partial.exists) partial.delete();
  try {
    await File.downloadFileAsync(url, partial);
  } catch (error) {
    if (partial.exists) partial.delete();
    throw error;
  }
  await partial.move(archive, { overwrite: true });

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
