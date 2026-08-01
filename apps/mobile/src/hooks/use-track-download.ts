import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppTranslation, type AppTFunction } from '@/hooks/use-translation';
import { ApiClient } from '@/services/api-client';
import { useDownloadManagerStore } from '@/store/download-manager-store';
import type { DownloadEntry as StoreDownloadEntry } from '@/store/download-manager-store';
import { logger } from '@/utils/logger';
import { useNetworkStatus } from '@/hooks/use-network-status';

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
  etag?: string | null;
}

/**
 * Maps a store download entry to the hook's TrackDownloadState interface.
 */
function mapStoreEntry(
  entry: StoreDownloadEntry | undefined,
  localCache: LocalCache | null,
  currentTrackId: string | null,
  t: AppTFunction,
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
        // Store payloads carry an i18n key (+ params); translate at the hook
        // boundary so the UI only ever sees localized text.
        errorMsg: entry.errorMsg ? t(entry.errorMsg.key, entry.errorMsg.params) : null,
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
  trackTitle: string,
): TrackDownloadState & { startDownload: () => void; deleteTrackLocal: () => Promise<void> } {
  const { t } = useAppTranslation();
  const { isOnline } = useNetworkStatus();

  // Subscribe to the store entry for this specific track
  const storeEntry = useDownloadManagerStore((s) => (trackId ? s.downloads[trackId] : undefined));

  // Cached local URI from filesystem check — survives across renders
  const [localCache, setLocalCache] = useState<LocalCache | null>(null);

  // Web-only: the blob URL created by this hook for the current localCache
  // entry. Revoked when replaced, cleared, or on unmount so it does not leak.
  const ownedWebObjectUrlRef = useRef<string | null>(null);

  function replaceOwnedWebObjectUrl(next: string | null): void {
    const prev = ownedWebObjectUrlRef.current;
    if (prev === next) return;
    if (prev && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(prev);
    }
    ownedWebObjectUrlRef.current = next;
  }

  // Check for pre-existing local file and validate its ETag
  useEffect(() => {
    if (!trackId) return;
    const currentTrackId = trackId;

    let cancelled = false;
    // The background ETag verification fetch is aborted by this controller
    // after 5s. Both are owned by this effect so its cleanup can stop the
    // timer directly and abort any in-flight request.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    async function checkAndValidateCache(verifyController: AbortController) {
      let cachedEtag: string | null = null;
      let localUri: string | null = null;

      if (Platform.OS === 'web') {
        if (typeof caches !== 'undefined') {
          try {
            const cache = await caches.open('sonora-audio-cache');
            const cacheKey = `https://sonora.local/tracks/${currentTrackId}`;
            const cachedResponse = await cache.match(cacheKey);
            if (cachedResponse) {
              const blob = await cachedResponse.blob();
              localUri = URL.createObjectURL(blob);
              cachedEtag =
                cachedResponse.headers.get('x-audio-etag') || cachedResponse.headers.get('etag');
            }
          } catch (err) {
            logger.error('Error validating web cache:', err);
          }
        }
      } else {
        const targetUri = getTargetUri(currentTrackId);
        if (targetUri) {
          try {
            const info = await FileSystem.getInfoAsync(targetUri);
            if (info.exists) {
              localUri = info.uri;
              const metadataUri = `${FileSystem.documentDirectory}tracks/${currentTrackId}/metadata.json`;
              const metaInfo = await FileSystem.getInfoAsync(metadataUri);
              if (metaInfo.exists) {
                const content = await FileSystem.readAsStringAsync(metadataUri);
                const meta = JSON.parse(content);
                cachedEtag = meta.etag;
              }
            }
          } catch (err) {
            logger.error('Error validating local cache:', err);
          }
        }
      }

      if (cancelled) return;

      if (localUri) {
        // Set the cache initially so it is playable immediately
        if (Platform.OS === 'web') {
          replaceOwnedWebObjectUrl(localUri);
        }
        setLocalCache({ trackId: currentTrackId, localUri, etag: cachedEtag });

        // If online and remoteAudioUrl is available, perform background verification of the ETag
        if (isOnline && remoteAudioUrl) {
          try {
            // Add a cache-buster query parameter to bypass intermediate caches
            const separator = remoteAudioUrl.includes('?') ? '&' : '?';
            const cacheBustUrl = `${remoteAudioUrl}${separator}_cb=${Date.now()}`;

            // Fetch only the headers using GET with Range: bytes=0-0 to retrieve R2 ETag
            const response = await ApiClient.fetchWithDeviceId(cacheBustUrl, {
              method: 'GET',
              headers: {
                Range: 'bytes=0-0',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
              },
              cache: 'no-store',
              signal: verifyController.signal,
            });

            if (response.ok || response.status === 206) {
              const serverEtag =
                response.headers.get('x-audio-etag') || response.headers.get('etag');

              if (serverEtag && serverEtag !== cachedEtag) {
                logger.warn(
                  `[CACHE_INVALIDATION] Audio ETag mismatch for track ${currentTrackId}. Local: ${cachedEtag}, Server: ${serverEtag}. Invalidating cache...`,
                );

                // Delete local cache files due to ETag mismatch
                if (Platform.OS === 'web') {
                  if (typeof caches !== 'undefined') {
                    const cache = await caches.open('sonora-audio-cache');
                    const cacheKey = `https://sonora.local/tracks/${currentTrackId}`;
                    await cache.delete(cacheKey);
                  }
                } else {
                  const targetUri = getTargetUri(currentTrackId);
                  if (targetUri) {
                    const info = await FileSystem.getInfoAsync(targetUri);
                    if (info.exists) {
                      await FileSystem.deleteAsync(targetUri);
                    }
                    const metadataUri = `${FileSystem.documentDirectory}tracks/${currentTrackId}/metadata.json`;
                    const metaInfo = await FileSystem.getInfoAsync(metadataUri);
                    if (metaInfo.exists) {
                      await FileSystem.deleteAsync(metadataUri);
                    }
                  }
                }

                // Reset Zustand store to idle so derived state updates immediately
                useDownloadManagerStore.getState().cancel(currentTrackId);

                if (!cancelled) {
                  replaceOwnedWebObjectUrl(null);
                  setLocalCache(null);
                }
              }
            } else {
              logger.warn(
                `[useTrackDownload] Server responded with status ${response.status} when checking ETag`,
              );
            }
          } catch (err) {
            logger.warn(
              `Failed to verify server ETag for track ${currentTrackId} (network or timeout):`,
              err,
            );
          }
        }
      } else {
        replaceOwnedWebObjectUrl(null);
        setLocalCache(null);
      }
    }

    checkAndValidateCache(controller);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
      // Free the blob URL owned by this hook (if the entry is replaced on a
      // re-run, the next run registers its own URL).
      replaceOwnedWebObjectUrl(null);
    };
  }, [trackId, remoteAudioUrl, isOnline]);

  // Derive state from store entry + cached local file
  const state = !trackId
    ? { status: 'idle' as DownloadStatus, progress: 0, localAudioUri: null, errorMsg: null }
    : mapStoreEntry(storeEntry, localCache, trackId, t);

  function startDownload() {
    if (!trackId || !remoteAudioUrl) {
      logger.warn('useTrackDownload: cannot start download — missing trackId or URL');
      return;
    }

    useDownloadManagerStore.getState().enqueue(trackId, remoteAudioUrl, trackTitle);
  }

  async function deleteTrackLocal() {
    if (!trackId) return;

    if (Platform.OS === 'web') {
      replaceOwnedWebObjectUrl(null);
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
      useDownloadManagerStore.getState().cancel(trackId);
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
    useDownloadManagerStore.getState().cancel(trackId);
  }

  return {
    ...state,
    startDownload,
    deleteTrackLocal,
  };
}
