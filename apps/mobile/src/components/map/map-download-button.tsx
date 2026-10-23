import { useCallback, useMemo, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useMapViewConfig } from '@/hooks/use-map-view-config';
import { useAppTranslation } from '@/hooks/use-translation';
import { archiveFileName, archiveIdentity, type ArchiveIdentity } from '@/services/map-archives';
import {
  archiveErrorCode,
  ensureArchiveOnDisk,
  listDownloadedArchives,
} from '@/services/map-archive-download';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { TwView } from '@/tw';
import { logger } from '@/utils/logger';

/**
 * Prepares this trip's map before the walker leaves.
 *
 * The startup prefetch already downloads the set the payload names as a preload, but
 * that set is the server's choice of places, not the trip in front of the walker. This
 * is the per-trip decision, and deliberately not a second policy engine: it downloads
 * one archive, for the region the trip's own coordinates resolve to, under the budget
 * the payload carries. It never asks, because a tap on this button *is* the answer; and
 * it is invisible whenever the download could not be read by anything:
 *
 *  - under `leaflet` the map draws raster OSM tiles and never opens an archive, so the
 *    action would promise something nothing consumes;
 *  - a trip outside every published region has no archive to prepare, and its map
 *    already says so instead of drawing somewhere else.
 *
 * The state lives here rather than in the screen: a trigger plus its own feedback is
 * one self-contained action, and the trip view has nothing to decide about it.
 */

/** What the action currently is, for one archive. */
type MapDownloadPhase = 'idle' | 'downloading' | 'available' | 'error';

/** A phase that belongs to one archive, so a config change never shows a stale one. */
interface MapDownloadSnapshot {
  /** The archive file name this phase is about. */
  key: string;
  phase: MapDownloadPhase;
}

export interface MapDownloadButtonProps {
  /** The trip's own point: the region it falls in is the one this prepares. */
  point: { latitude: number; longitude: number };
}

export function MapDownloadButton({ point }: MapDownloadButtonProps) {
  const { t } = useAppTranslation();
  const { renderer, regionKey, source } = useMapViewConfig(point);
  // Every transfer polices the same budget as the prefetch and the map itself. Read
  // defensively, because a store without a `map` section must not take the trip
  // screen down: absent simply means this action does not police the budget.
  const cacheMaxBytes = useRemoteConfigStore((state) => state.config.map?.download.cacheMaxBytes);
  const [snapshot, setSnapshot] = useState<MapDownloadSnapshot | null>(null);

  // Memoised because the identity is an object: a fresh one every render would make
  // the listing below believe a different archive is the one to look for.
  const identity: ArchiveIdentity | null = useMemo(
    () => (renderer === 'maplibre' ? archiveIdentity(source.archiveUrl, regionKey) : null),
    [renderer, source.archiveUrl, regionKey],
  );
  const archiveName = identity ? archiveFileName(identity) : null;

  /**
   * What the device already holds, read once per archive.
   *
   * The listing is the index, so it answers "is this archive here?" without a second
   * one: an archive this device already wrote needs no download, and saying so is more
   * useful than offering the action again. Memoised on the archive name because the
   * read is synchronous and the answer only changes when the archive does.
   */
  const alreadyOnDevice = useMemo(
    () =>
      archiveName !== null &&
      listDownloadedArchives().some((archive) => archive.name === archiveName),
    [archiveName],
  );

  // A settled download — this run's — is the whole truth about its own archive; an
  // archive nobody downloaded here is available exactly when it is on the device.
  const phase: MapDownloadPhase =
    snapshot?.key === archiveName ? snapshot.phase : alreadyOnDevice ? 'available' : 'idle';

  const startDownload = useCallback(() => {
    if (!identity || !archiveName) return;
    setSnapshot({ key: archiveName, phase: 'downloading' });
    void ensureArchiveOnDisk({ archiveUrl: source.archiveUrl, identity, cacheMaxBytes })
      .then(() => setSnapshot({ key: archiveName, phase: 'available' }))
      .catch((error: unknown) => {
        // The platform's own message stays in the log, as a stable code: the screen
        // shows a sentence we authored, and the transfer can be asked for again.
        logger.warn('map download button could not download the archive', archiveErrorCode(error));
        setSnapshot({ key: archiveName, phase: 'error' });
      });
  }, [identity, archiveName, source.archiveUrl, cacheMaxBytes]);

  if (!identity || !archiveName) return null;

  const available = phase === 'available';

  return (
    <TwView className="gap-1">
      <Button
        onPress={startDownload}
        label={available ? t('map.downloadAvailable') : t('map.downloadAction')}
        accessibilityLabel={available ? t('map.downloadAvailable') : t('map.downloadAction')}
        disabled={available}
        loading={phase === 'downloading'}
        variant={available ? 'secondary' : 'outline'}
        size="sm"
        testID="map-download-button"
      />
      {phase === 'downloading' && (
        <ThemedText type="small" themeColor="textSecondary" testID="map-download-button-progress">
          {t('map.downloadInProgress')}
        </ThemedText>
      )}
      {phase === 'error' && (
        <ThemedText type="small" themeColor="textSecondary" testID="map-download-button-error">
          {t('map.downloadFailure')}
        </ThemedText>
      )}
    </TwView>
  );
}

export default MapDownloadButton;
