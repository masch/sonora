import { useEffect, useMemo, useState } from 'react';

import { archiveFileName, archiveIdentity } from '@/services/map-archives';
import {
  archiveErrorCode,
  ensureArchiveOnDisk,
  type MapArchiveErrorCode,
} from '@/services/map-archive-download';
import { useRemoteConfigStore } from '@/store/remote-config-store';

export type { MapArchiveErrorCode } from '@/services/map-archive-download';
export { STALE_TEMPORARY_MS } from '@/services/map-archive-download';

type MapArchiveFileStatus = 'loading' | 'ready' | 'error';

export interface MapArchiveFileState {
  status: MapArchiveFileStatus;
  /** `pmtiles://file://…` of the complete archive on disk. */
  uri?: string;
  /** Why the archive could not be resolved, as the code the caller translates. */
  error?: MapArchiveErrorCode;
}

/**
 * The archive the native map source points at, as a `pmtiles://file://…` uri.
 *
 * @param source  the map source: the archive the config carries, with or without the
 *                `pmtiles://` scheme, and the region the experience resolved to. A map
 *                in no region has no archive to fetch, and neither has a source whose
 *                url does not name a versioned archive.
 * @param attempt which run this is: a retry starts the download over, and a settled
 *                result belongs to the run that produced it, never to the run that
 *                replaced it.
 */
export interface MapArchiveSource {
  archiveUrl?: string;
  /** `null` = the point fell in no region; absent = not resolved yet. */
  regionKey?: string | null;
}

export function useMapArchiveFile(
  source: MapArchiveSource | undefined,
  attempt = 0,
): MapArchiveFileState {
  const archiveUrl = source?.archiveUrl || undefined;
  const regionKey = source?.regionKey;
  const [settled, setSettled] = useState<{
    key: string;
    attempt: number;
    value: MapArchiveFileState;
  } | null>(null);
  // Memoised because the identity is an object: a fresh one on every render would
  // restart the run the effect just started.
  const identity = useMemo(() => archiveIdentity(archiveUrl, regionKey), [archiveUrl, regionKey]);
  const key = useMemo(() => (identity ? archiveFileName(identity) : null), [identity]);
  // Every transfer polices the same budget, so a map opened for the first time cannot
  // grow the cache past what the payload allows.
  const cacheMaxBytes = useRemoteConfigStore((state) => state.config.map.download.cacheMaxBytes);

  useEffect(() => {
    if (!archiveUrl || !identity || !key) return;

    // Cancellation is per run: a url change cancels only the run it started, so an
    // abandoned download can never settle the state of the run that replaced it.
    let cancelled = false;

    /** Settles this run once. */
    const settle = (value: MapArchiveFileState): void => {
      if (cancelled) return;
      cancelled = true;
      setSettled({ key, attempt, value });
    };

    ensureArchiveOnDisk({ archiveUrl, identity, cacheMaxBytes })
      .then((uri) => settle({ status: 'ready', uri }))
      .catch((error: unknown) =>
        settle({
          status: 'error',
          error: archiveErrorCode(error),
        }),
      );

    return () => {
      // Withdraws only this run's settle; the transfer keeps writing the same archive
      // the map will want, so a late landing is not wasted.
      cancelled = true;
    };
  }, [archiveUrl, key, attempt, identity, cacheMaxBytes]);

  if (!key) return { status: 'error', error: 'archiveMissing' };
  // A settled result for another archive — or for another attempt of this one —
  // says nothing about this run.
  if (settled?.key === key && settled.attempt === attempt) return settled.value;
  return { status: 'loading' };
}
