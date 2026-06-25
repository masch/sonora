import { useState, useEffect } from 'react';
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

interface LocalCache {
  trackId: string;
  localUri: string;
}

/**
 * Maps a store download entry to the hook's TrackDownloadState interface.
 */
function mapStoreEntry(
  entry: StoreDownloadEntry | undefined,
  localCache: LocalCache | null,
  currentTrackId: string | null,
): TrackDownloadState {
  if (!entry) {
    // No store entry — use cached local URI from FS check if it belongs to current track
    if (localCache && localCache.trackId === currentTrackId) {
      return {
        status: 'completed',
        progress: 100,
        localAudioUri: localCache.localUri,
        errorMsg: null,
      };
    }
    return { status: 'idle', progress: 0, localAudioUri: null, errorMsg: null };
  }

  // Store entry is the source of truth when available
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
  const [localCache, setLocalCache] = useState<LocalCache | null>(null);

  // One-time check for pre-existing local file
  useEffect(() => {
    if (!trackId) return;

    let cancelled = false;

    if (Platform.OS === 'web') {
      if (typeof caches === 'undefined') return;
      async function checkWebCache() {
        try {
          const cache = await caches.open('sonora-audio-cache');
          const cacheKey = `https://sonora.local/tracks/${trackId}`;
          const cachedResponse = await cache.match(cacheKey);
          if (cachedResponse && !cancelled) {
            const blob = await cachedResponse.blob();
            const localUri = URL.createObjectURL(blob);
            setLocalCache({ trackId: trackId as string, localUri });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error validating web cache';
          logger.error(msg);
        }
      }
      checkWebCache();
      return () => {
        cancelled = true;
      };
    }

    const targetUri = getTargetUri(trackId);
    if (!targetUri) return;

    async function checkLocalFile() {
      try {
        const info = await FileSystem.getInfoAsync(targetUri as string);
        if (!cancelled && info.exists) {
          setLocalCache({ trackId: trackId as string, localUri: info.uri });
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
  }, [trackId, remoteAudioUrl]);

  // Derive state from store entry + cached local file
  const state = !trackId
    ? { status: 'idle' as DownloadStatus, progress: 0, localAudioUri: null, errorMsg: null }
    : mapStoreEntry(storeEntry, localCache, trackId);

  function startDownload() {
    if (!trackId || !remoteAudioUrl) {
      logger.warn('useTrackDownload: cannot start download — missing trackId or URL');
      return;
    }

    useDownloadManagerStore.getState().enqueue(trackId, remoteAudioUrl);
  }

  async function deleteTrackLocal() {
    if (Platform.OS === 'web') {
      setLocalCache(null);
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open('sonora-audio-cache');
          const cacheKey = `https://sonora.local/tracks/${trackId}`;
          await cache.delete(cacheKey);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to delete web cache';
          logger.error(msg);
        }
      }
      return;
    }

    const targetUri = getTargetUri(trackId);
    if (!targetUri) return;

    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri);
      }
      setLocalCache(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('errors.deleteFailed');
      logger.error(msg);
    }
  }

  return {
    ...state,
    startDownload,
    deleteTrackLocal,
  };
}
