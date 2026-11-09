import { useEffect } from 'react';

import type { MapWaitErrorCode } from './map-view.types';
import { reportMapFailure } from './report-map-failure';

/** What the native renderer knows about the failure it resolved. */
export interface MapFailureReport {
  /** The failure `failureCode` resolved, or `undefined` when the map can still draw. */
  failure: MapWaitErrorCode | undefined;
  /**
   * The archive is the wait that failed.
   *
   * It is passed rather than inferred from `failure`, because `failureCode` prefers the
   * archive: a stage derived from the code alone would name the wrong document when both
   * waits have failed.
   */
  archiveFailed: boolean;
  /** The archive the renderer tried to read, when an archive is configured. */
  archiveUrl?: string;
  /** The style document it tried to fetch, when a style is configured. */
  styleUrl?: string;
  /** The answer the server gave for the style, when a server was the one that failed. */
  httpStatus?: number;
}

/**
 * The one report a native map failure makes, once per episode.
 *
 * It lives beside the renderer rather than inside it for two reasons. It is an effect and
 * not part of the render body: the report is a side effect of a commit, the renderer
 * commits more than once over one failure, and a call from the render body would lean on
 * the episode registry instead of not happening. And the component that draws the map is
 * already the largest in this module, so the reporting reads better outside it.
 *
 * The stage and the url are the wait the code came from, never inferred from the code
 * alone: an archive that failed is the archive's. A place in no region has no failure at
 * all and reports nothing.
 */
export function useMapFailureReport({
  failure,
  archiveFailed,
  archiveUrl,
  styleUrl,
  httpStatus,
}: MapFailureReport): void {
  useEffect(() => {
    if (!failure) return;
    reportMapFailure(failure, {
      stage: archiveFailed ? 'archive' : 'style',
      url: (archiveFailed ? archiveUrl : styleUrl) ?? null,
      httpStatus: archiveFailed ? null : (httpStatus ?? null),
    });
  }, [failure, archiveFailed, archiveUrl, styleUrl, httpStatus]);
}
