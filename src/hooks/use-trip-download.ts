import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppTranslation } from '@/hooks/use-translation';
import { logger } from '@/utils/logger';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';

export interface TripDownloadState {
  status: DownloadStatus;
  progress: number;
  localAudioUri: string | null;
  errorMsg: string | null;
}

// 50MB safety multiplier constraint
const SIZE_MULTIPLIER = 1.5;

const getTargetUri = (tripId: string | null) => {
  if (!tripId) return null;
  return `${FileSystem.documentDirectory}trips/${tripId}/audio.mp3`;
};

export function useTripDownload(
  tripId: string | null,
  remoteAudioUrl: string | null,
  estimatedSizeBytes: number = 30 * 1024 * 1024, // default ~30MB
) {
  const { t } = useAppTranslation();
  const [state, setState] = useState<TripDownloadState>({
    status: 'idle',
    progress: 0,
    localAudioUri: null,
    errorMsg: null,
  });

  const downloadResumableRef = useRef<FileSystem.DownloadResumable | null>(null);

  useEffect(() => {
    if (!tripId || !remoteAudioUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        status: 'idle',
        progress: 0,
        localAudioUri: null,
        errorMsg: null,
      });
      return;
    }

    async function checkLocalFile() {
      try {
        const targetUri = getTargetUri(tripId);
        if (!targetUri) return;

        const info = await FileSystem.getInfoAsync(targetUri);
        if (info.exists) {
          setState({
            status: 'completed',
            progress: 100,
            localAudioUri: info.uri,
            errorMsg: null,
          });
        } else {
          setState({
            status: 'idle',
            progress: 0,
            localAudioUri: null,
            errorMsg: null,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error validating local cache';
        logger.error(msg);
      }
    }

    checkLocalFile();

    return () => {
      if (downloadResumableRef.current) {
        downloadResumableRef.current.pauseAsync().catch((err: unknown) => {
          logger.warn('Failed to auto-pause download on unmount', err);
        });
      }
    };
  }, [tripId, remoteAudioUrl]);

  const startDownload = async () => {
    const targetUri = getTargetUri(tripId);
    if (!tripId || !remoteAudioUrl || !targetUri) {
      setState((prev) => ({ ...prev, errorMsg: t('errors.invalidDownloadConfig') }));
      return;
    }

    setState({
      status: 'downloading',
      progress: 0,
      localAudioUri: null,
      errorMsg: null,
    });

    try {
      // 1. Verify Storage Space (not available on web)
      try {
        const freeSpace = await FileSystem.getFreeDiskStorageAsync();
        const requiredSpace = estimatedSizeBytes * SIZE_MULTIPLIER;
        if (freeSpace < requiredSpace) {
          throw new Error(
            t('errors.insufficientSpace', {
              free: (freeSpace / 1024 / 1024).toFixed(1),
              required: (requiredSpace / 1024 / 1024).toFixed(1),
            }),
          );
        }
      } catch (storageErr: unknown) {
        // On web, getFreeDiskStorageAsync is not available — skip the check
        if (Platform.OS !== 'web') throw storageErr;
      }

      // 2. Download — use fetch on web, expo-file-system on native
      if (Platform.OS === 'web') {
        await webDownload(remoteAudioUrl);
      } else {
        await nativeDownload(remoteAudioUrl, targetUri, tripId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error downloading trip';
      setState({
        status: 'error',
        progress: 0,
        localAudioUri: null,
        errorMsg: msg,
      });
      logger.error('Download execution error:', msg);
    }
  };

  async function webDownload(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback: read entire blob at once (no progress tracking)
      const blob = await response.blob();
      const blobUri = URL.createObjectURL(blob);
      setState({
        status: 'completed',
        progress: 100,
        localAudioUri: blobUri,
        errorMsg: null,
      });
      return;
    }

    const contentLength = Number(response.headers.get('Content-Length') ?? '0');
    let received = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) {
        setState((prev) => ({
          ...prev,
          progress: Math.floor((received / contentLength) * 100),
        }));
      }
    }

    const blob = new Blob(chunks, { type: response.headers.get('Content-Type') ?? 'audio/mpeg' });
    const blobUri = URL.createObjectURL(blob);
    setState({
      status: 'completed',
      progress: 100,
      localAudioUri: blobUri,
      errorMsg: null,
    });
  }

  async function nativeDownload(url: string, targetUri: string, tripId: string) {
    // 2. Ensure parent directory exists
    const parentDir = `${FileSystem.documentDirectory}trips/${tripId}/`;
    const dirInfo = await FileSystem.getInfoAsync(parentDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
    }

    // 3. Initiate Download
    downloadResumableRef.current = FileSystem.createDownloadResumable(
      url,
      targetUri,
      {},
      (downloadProgress) => {
        const progressPercent =
          (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
        setState((prev) => ({
          ...prev,
          progress: Math.floor(progressPercent),
        }));
      },
    );

    const result = await downloadResumableRef.current.downloadAsync();
    if (result && result.uri) {
      setState({
        status: 'completed',
        progress: 100,
        localAudioUri: result.uri,
        errorMsg: null,
      });
    } else {
      throw new Error(t('errors.downloadWriteFailed'));
    }
  }

  const deleteTripLocal = async () => {
    // On web, blob URLs are ephemeral — just reset state
    if (Platform.OS === 'web') {
      // Revoke the blob URL to free memory
      if (state.localAudioUri?.startsWith('blob:')) {
        URL.revokeObjectURL(state.localAudioUri);
      }
      setState({
        status: 'idle',
        progress: 0,
        localAudioUri: null,
        errorMsg: null,
      });
      return;
    }

    const targetUri = getTargetUri(tripId);
    if (!targetUri) return;

    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri);
      }
      setState({
        status: 'idle',
        progress: 0,
        localAudioUri: null,
        errorMsg: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error removing local file';
      setState((prev) => ({ ...prev, errorMsg: msg }));
      logger.error(msg);
    }
  };

  return {
    ...state,
    startDownload,
    deleteTripLocal,
  };
}
