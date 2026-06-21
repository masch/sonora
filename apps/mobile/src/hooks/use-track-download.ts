import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppTranslation } from '@/hooks/use-translation';
import { useDownloadManagerStore } from '@/store/download-manager-store';
import type { DownloadEntry as StoreDownloadEntry } from '@/store/download-manager-store';
import { logger } from '@/utils/logger';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';

export interface TrackDownloadState {
  status: DownloadStatus;
  progress: number;
  localAudioUri: string | null;
  errorMsg: string | null;
}

const getTargetUri = (trackId: string | null) => {
  if (!trackId) return null;
  return `${FileSystem.documentDirectory}tracks/${trackId}/audio.mp3`;
};

/**
 * Maps a store download entry to the hook's TrackDownloadState interface.
 */
function mapStoreEntry(
  entry: StoreDownloadEntry | undefined,
  cachedLocalUri: string | null,
): TrackDownloadState {
  // If we have a cached local URI from an earlier file-system check, show
  // completed regardless of store state (file was already downloaded before).
  if (cachedLocalUri) {
    return { status: 'completed', progress: 100, localAudioUri: cachedLocalUri, errorMsg: null };
  }

  if (!entry) {
    return { status: 'idle', progress: 0, localAudioUri: null, errorMsg: null };
  }

  switch (entry.status) {
    case 'queued':
    case 'downloading':
      return {
        status: 'downloading',
        progress: entry.progress,
        localAudioUri: null,
        errorMsg: null,
      };
    case 'completed':
      return {
        status: 'completed',
        progress: 100,
        localAudioUri: entry.localUri,
        errorMsg: null,
      };
    case 'error':
      return {
        status: 'error',
        progress: 0,
        localAudioUri: null,
        errorMsg: entry.errorMsg,
      };
    default:
      return { status: 'idle', progress: 0, localAudioUri: null, errorMsg: null };
  }
}

/**
 * Hook that manages track audio download state.
 *
 * Refactored to delegate the actual download to `useDownloadManagerStore`
 * while keeping the same `TrackDownloadState` return interface for backward
 * compatibility with existing consumers.
 *
 * On mount, checks the local file system for pre-existing downloads.
 * Once a download is enqueued, all state transitions flow through the
 * centralized download store.
 */
export function useTrackDownload(
  trackId: string | null,
  remoteAudioUrl: string | null,
  _estimatedSizeBytes?: number,
): TrackDownloadState & { startDownload: () => void; deleteTrackLocal: () => Promise<void> } {
  const { t } = useAppTranslation();

  // Subscribe to the store entry for this specific track
  const storeEntry = useDownloadManagerStore((s) => (trackId ? s.downloads[trackId] : undefined));

  // Cached local URI from filesystem check — survives across renders
  const [cachedLocalUri, setCachedLocalUri] = useState<string | null>(null);

  // One-time check for pre-existing local file
  useEffect(() => {
    if (!trackId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCachedLocalUri(null);
      return;
    }

    // If the store already has a completed entry, no need to check FS
    if (storeEntry?.status === 'completed') {
      setCachedLocalUri(storeEntry.localUri);
      return;
    }

    // Skip filesystem check on web
    if (Platform.OS === 'web') return;

    const targetUri = getTargetUri(trackId);
    if (!targetUri) return;

    let cancelled = false;

    async function checkLocalFile() {
      try {
        const info = await FileSystem.getInfoAsync(targetUri as string);
        if (!cancelled && info.exists) {
          setCachedLocalUri(info.uri);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error validating local cache';
        logger.error(msg);
      }
    }

    checkLocalFile();

    return () => {
      cancelled = true;
    };
  }, [trackId, storeEntry?.status, storeEntry?.localUri]);

  // Derive state from store entry + cached local file
  const state = !trackId
    ? { status: 'idle' as DownloadStatus, progress: 0, localAudioUri: null, errorMsg: null }
    : mapStoreEntry(storeEntry, cachedLocalUri);

  const startDownload = useCallback(() => {
    if (!trackId || !remoteAudioUrl) {
      logger.warn('useTrackDownload: cannot start download — missing trackId or URL');
      return;
    }

    useDownloadManagerStore.getState().enqueue(trackId, remoteAudioUrl);
  }, [trackId, remoteAudioUrl]);

  const deleteTrackLocal = useCallback(async () => {
    if (Platform.OS === 'web') {
      setCachedLocalUri(null);
      return;
    }

    const targetUri = getTargetUri(trackId);
    if (!targetUri) return;

    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri);
      }
      setCachedLocalUri(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('errors.deleteFailed');
      logger.error(msg);
    }
  }, [trackId, t]);

  return {
    ...state,
    startDownload,
    deleteTrackLocal,
  };
}
