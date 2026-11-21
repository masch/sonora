import { useCallback, useMemo } from 'react';

import { stageOfFailure, type MapLoadErrorCode, type MapWaitState } from './map-view.types';

/** The counters a restart can bump: one per wait the web renderer has. */
export interface WebRetryCounters {
  readonly setArchiveAttempt: (update: (previous: number) => number) => void;
  readonly setStyleAttempt: (update: (previous: number) => number) => void;
  readonly setMapErrorCode: (code: null) => void;
  readonly setMapAttempt: (update: (previous: number) => number) => void;
}

/**
 * Restarts the wait that failed, and only that one.
 *
 * The stage of the failure decides which counter is bumped: the archive, the style
 * document, or the map build itself, whose failure is withdrawn and repaid with a
 * new attempt. Living here so the renderer component stays at the size the doctor
 * gate allows.
 */
export function useWebRetry(
  failure: MapLoadErrorCode | undefined,
  counters: WebRetryCounters,
): () => void {
  const { setArchiveAttempt, setStyleAttempt, setMapErrorCode, setMapAttempt } = counters;
  return useCallback(() => {
    if (!failure) return;
    switch (stageOfFailure(failure)) {
      case 'archive':
        setArchiveAttempt((previous) => previous + 1);
        break;
      case 'style':
        setStyleAttempt((previous) => previous + 1);
        break;
      case 'map':
        // Nothing to restart but the map itself: the failure is withdrawn and the
        // build below runs again.
        setMapErrorCode(null);
        setMapAttempt((previous) => previous + 1);
        break;
    }
  }, [failure, setArchiveAttempt, setStyleAttempt, setMapErrorCode, setMapAttempt]);
}

/**
 * The wait the web renderer is in, and `null` exactly when it can draw.
 *
 * The archive arrives whole and the percentage lives in the browser's transfer, so
 * this renderer names the stage and never a number it cannot read. A failure is not
 * a wait: it has a surface of its own, with words of its own.
 */
export function useWebWait(
  failure: MapLoadErrorCode | undefined,
  archiveStatus: 'loading' | 'ready' | 'error',
  ready: boolean,
): MapWaitState | null {
  return useMemo(() => {
    if (failure) return null;
    if (archiveStatus === 'loading') {
      return { stage: 'archive', downloading: false, progress: null };
    }
    return ready ? null : { stage: 'map', downloading: false, progress: null };
  }, [failure, archiveStatus, ready]);
}
