import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { AnalyticsService } from '@/services/analytics';
import { ApiClient } from '@/services/api-client';
import { getDeviceId } from '@/storage/app-storage';
import { logger } from '@/utils/logger';
import type { TranslationKeys } from '@/i18n/types';

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'completed' | 'error';

/**
 * Download failure payload stored on the entry. Carries an i18n key (+ optional
 * interpolation params) so the UI can translate at render time — the store
 * itself has no access to the translation hook.
 */
export interface DownloadErrorPayload {
  key: TranslationKeys;
  params?: Record<string, string | number>;
}

/**
 * Typed error for known download failures. The `key`/`params` are persisted
 * to the store entry and translated by the consuming hook/component.
 */
class DownloadError extends Error {
  constructor(
    readonly key: TranslationKeys,
    readonly params?: Record<string, string | number>,
  ) {
    super(`DownloadError: ${key}`);
    this.name = 'DownloadError';
  }
}

export interface DownloadEntry {
  status: DownloadStatus;
  progress: number;
  localUri: string | null;
  errorMsg: DownloadErrorPayload | null;
  title: string;
}

export interface DownloadItem {
  trackId: string;
  url: string;
  title: string;
}

export interface DownloadManagerState {
  downloads: Record<string, DownloadEntry>;
  queue: DownloadItem[];
  activeCount: number;
  maxConcurrent: number;
}

export interface DownloadManagerActions {
  enqueue: (trackId: string, url: string, title: string) => void;
  cancel: (trackId: string) => void;
  getDownload: (trackId: string) => DownloadEntry | undefined;
  _completeDownload: (trackId: string, localUri: string) => void;
  _failDownload: (trackId: string, error: DownloadErrorPayload) => void;
  _updateProgress: (trackId: string, progress: number) => void;
}

export type DownloadManagerStore = DownloadManagerState & DownloadManagerActions;

// Web playback uses blob URLs created via URL.createObjectURL as the store's
// localUri. They must stay alive as long as the download entry owns them, so
// they are registered here on creation and revoked only when the entry
// discards them (cancel of a completed download, or a failed re-download).
const webObjectUrlRegistry = new Map<string, string>();

function registerWebObjectUrl(trackId: string, url: string): void {
  webObjectUrlRegistry.set(trackId, url);
}

function revokeWebObjectUrl(trackId: string): void {
  const url = webObjectUrlRegistry.get(trackId);
  webObjectUrlRegistry.delete(trackId);
  if (url && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

async function performFileDownload(
  trackId: string,
  url: string,
  onProgress: (progress: number) => void,
): Promise<{ localUri: string }> {
  const parentDir = `${FileSystem.documentDirectory}tracks/${trackId}/`;
  const targetUri = `${parentDir}audio.mp3`;

  // Ensure directory exists
  await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });

  const deviceId = await getDeviceId();

  // Perform download
  const result = await FileSystem.createDownloadResumable(
    url,
    targetUri,
    {
      headers: deviceId ? { 'X-Device-Id': deviceId } : {},
    },
    (downloadProgress) => {
      const pct =
        (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
      onProgress(Math.floor(pct));
    },
  ).downloadAsync();

  if (!result || !result.uri) {
    throw new DownloadError('errors.downloadWriteFailed');
  }

  // Save ETag to metadata file if available
  let etag: string | undefined;
  if (result.headers) {
    const headersLower = Object.fromEntries(
      Object.entries(result.headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    etag = headersLower['x-audio-etag'] || headersLower['etag'];
  }

  if (etag) {
    try {
      const metadataUri = `${parentDir}metadata.json`;
      await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify({ etag, url }));
    } catch (err) {
      logger.error('Failed to write metadata for track', trackId, err);
    }
  }

  return { localUri: result.uri };
}

async function performWebDownload(
  trackId: string,
  url: string,
  onProgress: (progress: number) => void,
): Promise<{ localUri: string }> {
  // Check Cache Storage first — avoids a network round-trip for already-downloaded tracks.
  // This is the primary guard against offline failures: after a page refresh the Zustand
  // store is empty (ephemeral) even when the file was previously cached, so we must
  // re-check the Cache API before touching the network.
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('sonora-audio-cache');
      const cacheKey = `https://sonora.local/tracks/${trackId}`;
      const cached = await cache.match(cacheKey);
      if (cached) {
        const blob = await cached.blob();
        onProgress(100);
        const localUri = URL.createObjectURL(blob);
        registerWebObjectUrl(trackId, localUri);
        return { localUri };
      }
    } catch {
      // Cache miss or storage error — fall through to network download
    }
  }

  const response = await ApiClient.fetchWithDeviceId(url);
  if (!response.ok) {
    throw new DownloadError('errors.fetchFailed', { status: String(response.status) });
  }

  const etag = response.headers.get('x-audio-etag') || response.headers.get('etag');

  const reader = response.body?.getReader();
  // Fallback if Cache Storage or body reader is unavailable
  if (typeof caches === 'undefined' || !reader) {
    const blob = await response.blob();
    const localUri = URL.createObjectURL(blob);
    registerWebObjectUrl(trackId, localUri);
    return { localUri };
  }

  const cache = await caches.open('sonora-audio-cache');
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (total > 0) {
      const pct = (receivedLength / total) * 100;
      onProgress(Math.min(99, Math.floor(pct))); // Hold at 99% until completed
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
  const localUri = URL.createObjectURL(blob);
  registerWebObjectUrl(trackId, localUri);

  // Cache the response constructed from the downloaded blob using a stable cache key
  const cachedResponse = new Response(blob, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': blob.size.toString(),
      ...(etag ? { ETag: etag } : {}),
      ...(etag ? { 'x-audio-etag': etag } : {}),
    },
  });
  const cacheKey = `https://sonora.local/tracks/${trackId}`;
  await cache.put(cacheKey, cachedResponse);

  return { localUri };
}

async function performDownload(trackId: string, url: string, title: string) {
  const isWeb = Platform.OS === 'web';
  const downloadFn = isWeb ? performWebDownload : performFileDownload;

  AnalyticsService.trackEvent('audio_download_started', { track_id: trackId, url, title });

  try {
    const { localUri } = await downloadFn(trackId, url, (progress) => {
      useDownloadManagerStore.getState()._updateProgress(trackId, progress);
    });

    useDownloadManagerStore.getState()._completeDownload(trackId, localUri);
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    logger.error('Download failed for', trackId, raw);
    useDownloadManagerStore
      .getState()
      ._failDownload(
        trackId,
        err instanceof DownloadError
          ? { key: err.key, params: err.params }
          : { key: 'errors.downloadFailed' },
      );
  }
}

function processQueue(
  get: () => DownloadManagerStore,
  set: (state: Partial<DownloadManagerStore>) => void,
) {
  let state = get();
  while (state.queue.length > 0 && state.activeCount < state.maxConcurrent) {
    const next = state.queue[0];
    const remaining = state.queue.slice(1);

    const updatedDownloads = {
      ...state.downloads,
      [next.trackId]: {
        status: 'downloading' as DownloadStatus,
        progress: 0,
        localUri: null,
        errorMsg: null,
        title: next.title,
      },
    };

    set({
      queue: remaining,
      downloads: updatedDownloads,
      activeCount: state.activeCount + 1,
    });

    // Fire-and-forget the actual download
    performDownload(next.trackId, next.url, next.title);

    state = get(); // Refresh state for next loop iteration
  }
}

export const useDownloadManagerStore = create<DownloadManagerStore>((set, get) => ({
  downloads: {},
  queue: [],
  activeCount: 0,
  maxConcurrent: 3,

  enqueue: (trackId: string, url: string, title: string) => {
    const existing = get().downloads[trackId];
    if (existing && (existing.status === 'downloading' || existing.status === 'completed')) {
      return;
    }

    // Initialize entry
    set({
      downloads: {
        ...get().downloads,
        [trackId]: {
          status: 'queued',
          progress: 0,
          localUri: null,
          errorMsg: null,
          title,
        },
      },
    });

    if (get().activeCount < get().maxConcurrent) {
      // Start immediately
      set({
        downloads: {
          ...get().downloads,
          [trackId]: {
            status: 'downloading' as DownloadStatus,
            progress: 0,
            localUri: null,
            errorMsg: null,
            title,
          },
        },
        activeCount: get().activeCount + 1,
      });
      performDownload(trackId, url, title);
    } else {
      // Add to FIFO queue
      set({
        queue: [...get().queue, { trackId, url, title }],
      });
    }
  },

  cancel: (trackId: string) => {
    const entry = get().downloads[trackId];
    if (!entry) return;

    // A completed entry's blob URL is no longer the active playback source.
    if (entry.status === 'completed') {
      revokeWebObjectUrl(trackId);
    }

    const filteredQueue = get().queue.filter((item) => item.trackId !== trackId);
    const isActive = entry.status === 'downloading';

    set({
      downloads: {
        ...get().downloads,
        [trackId]: {
          status: 'idle',
          progress: 0,
          localUri: null,
          errorMsg: null,
          title: entry.title,
        },
      },
      queue: filteredQueue,
      activeCount: isActive ? get().activeCount - 1 : get().activeCount,
    });

    if (isActive) {
      processQueue(get, set);
    }
  },

  getDownload: (trackId: string) => {
    return get().downloads[trackId];
  },

  _completeDownload: (trackId: string, localUri: string) => {
    const entry = get().downloads[trackId];
    if (!entry) {
      logger.error('Attempted to complete download for non-existent track:', trackId);
      return;
    }
    const { title } = entry;
    AnalyticsService.trackEvent('audio_download_completed', { track_id: trackId, title });
    set({
      downloads: {
        ...get().downloads,
        [trackId]: {
          status: 'completed',
          progress: 100,
          localUri,
          errorMsg: null,
          title,
        },
      },
      activeCount: get().activeCount - 1,
    });

    processQueue(get, set);
  },

  _failDownload: (trackId: string, error: DownloadErrorPayload) => {
    const entry = get().downloads[trackId];
    if (!entry) {
      logger.error('Attempted to fail download for non-existent track:', trackId);
      return;
    }
    // The failed download's object URL (if any) is never exposed — free it.
    revokeWebObjectUrl(trackId);
    const { title } = entry;
    AnalyticsService.trackEvent('audio_download_failed', {
      track_id: trackId,
      error_msg: error.key,
      title,
    });
    AnalyticsService.recordError(new Error(error.key), `Download failed for track ${trackId}`);
    set({
      downloads: {
        ...get().downloads,
        [trackId]: {
          status: 'error',
          progress: 0,
          localUri: null,
          errorMsg: error,
          title,
        },
      },
      activeCount: get().activeCount - 1,
    });

    processQueue(get, set);
  },

  _updateProgress: (trackId: string, progress: number) => {
    const entry = get().downloads[trackId];
    if (!entry || entry.status !== 'downloading') return;

    set({
      downloads: {
        ...get().downloads,
        [trackId]: { ...entry, progress },
      },
    });
  },
}));
