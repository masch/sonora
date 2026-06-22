import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';

import { logger } from '@/utils/logger';

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'completed' | 'error';

export interface DownloadEntry {
  status: DownloadStatus;
  progress: number;
  localUri: string | null;
  errorMsg: string | null;
}

export interface DownloadItem {
  trackId: string;
  url: string;
}

export interface DownloadManagerState {
  downloads: Record<string, DownloadEntry>;
  queue: DownloadItem[];
  activeCount: number;
  maxConcurrent: number;
}

export interface DownloadManagerActions {
  enqueue: (trackId: string, url: string) => void;
  cancel: (trackId: string) => void;
  getDownload: (trackId: string) => DownloadEntry | undefined;
  _completeDownload: (trackId: string, localUri: string) => void;
  _failDownload: (trackId: string, errorMsg: string) => void;
  _updateProgress: (trackId: string, progress: number) => void;
}

export type DownloadManagerStore = DownloadManagerState & DownloadManagerActions;

async function performFileDownload(
  trackId: string,
  url: string,
  onProgress: (progress: number) => void,
): Promise<{ localUri: string }> {
  const parentDir = `${FileSystem.documentDirectory}tracks/${trackId}/`;
  const targetUri = `${parentDir}audio.mp3`;

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(parentDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
  }

  // Perform download
  const result = await FileSystem.createDownloadResumable(
    url,
    targetUri,
    {},
    (downloadProgress) => {
      const pct =
        (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
      onProgress(Math.floor(pct));
    },
  ).downloadAsync();

  if (!result || !result.uri) {
    throw new Error('Download failed to write file');
  }

  return { localUri: result.uri };
}

async function performDownload(trackId: string, url: string) {
  // Web has no local filesystem — stream directly from the remote URL
  if (Platform.OS === 'web') {
    useDownloadManagerStore.getState()._completeDownload(trackId, url);
    return;
  }

  try {
    const { localUri } = await performFileDownload(trackId, url, (progress) => {
      useDownloadManagerStore.getState()._updateProgress(trackId, progress);
    });

    useDownloadManagerStore.getState()._completeDownload(trackId, localUri);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Download failed';
    logger.error('Download failed for', trackId, msg);
    useDownloadManagerStore.getState()._failDownload(trackId, msg);
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
      },
    };

    set({
      queue: remaining,
      downloads: updatedDownloads,
      activeCount: state.activeCount + 1,
    });

    // Fire-and-forget the actual download
    performDownload(next.trackId, next.url);

    state = get(); // Refresh state for next loop iteration
  }
}

export const useDownloadManagerStore = create<DownloadManagerStore>((set, get) => ({
  downloads: {},
  queue: [],
  activeCount: 0,
  maxConcurrent: 3,

  enqueue: (trackId: string, url: string) => {
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
          },
        },
        activeCount: get().activeCount + 1,
      });
      performDownload(trackId, url);
    } else {
      // Add to FIFO queue
      set({
        queue: [...get().queue, { trackId, url }],
      });
    }
  },

  cancel: (trackId: string) => {
    const entry = get().downloads[trackId];
    if (!entry) return;

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
    set({
      downloads: {
        ...get().downloads,
        [trackId]: {
          status: 'completed',
          progress: 100,
          localUri,
          errorMsg: null,
        },
      },
      activeCount: get().activeCount - 1,
    });

    processQueue(get, set);
  },

  _failDownload: (trackId: string, errorMsg: string) => {
    set({
      downloads: {
        ...get().downloads,
        [trackId]: {
          status: 'error',
          progress: 0,
          localUri: null,
          errorMsg,
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
