import { useState, useEffect, useRef } from 'react';
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
      // 1. Verify Storage Space
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

      // 2. Ensure parent directory exists
      const parentDir = `${FileSystem.documentDirectory}trips/${tripId}/`;
      const dirInfo = await FileSystem.getInfoAsync(parentDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
      }

      // 3. Initiate Download
      downloadResumableRef.current = FileSystem.createDownloadResumable(
        remoteAudioUrl,
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

  const deleteTripLocal = async () => {
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
