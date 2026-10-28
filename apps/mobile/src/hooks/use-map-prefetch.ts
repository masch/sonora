import { useCallback, useEffect, useRef, useState } from 'react';

import NetInfo from '@react-native-community/netinfo';
import type { MapDownloadPolicy } from '@sonora/shared';

import { resolveMapRenderer } from '@/components/map/resolve-renderer';
import { APP_CONFIG } from '@/config/app-config';
import { archiveFileName, archiveIdentity, isArchiveCurrent } from '@/services/map-archives';
import { ensureArchiveOnDisk, listDownloadedArchives } from '@/services/map-archive-download';
import { canKeepMapArchive } from '@/services/map-archive-support';
import { decideDownload, type MapNetwork } from '@/services/map-download-policy';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { logger } from '@/utils/logger';

/**
 * Downloads the regions the payload names as the preload set, when the app opens.
 *
 * The rule the product asked for is "the map downloads as soon as the app opens, by
 * itself on WiFi and asking on mobile data", so this runs after `/config` resolves —
 * never before it, because the catalog is what says which regions exist, what they
 * cost and what the policy is — and only when the device resolved to `maplibre`:
 * the Leaflet path draws raster OSM tiles and never reads an archive.
 *
 * The whole set is priced and decided once. Three regions must not produce three
 * prompts, and the walker says yes or no to what the download really costs.
 */

/** One region this run would download. */
export interface MapPrefetchRegion {
  key: string;
  label: string;
  bytes: number;
  archiveUrl: string;
}

/** What the walker is asked, when the policy says to ask. */
export interface MapPrefetchPrompt {
  regions: MapPrefetchRegion[];
  totalBytes: number;
}

export interface MapPrefetchState {
  /** The regions to ask about, or null when nothing needs asking. */
  prompt: MapPrefetchPrompt | null;
  /** Download what was asked about. */
  accept: () => void;
  /** Keep the connection: nothing is downloaded, and the map still works. */
  dismiss: () => void;
}

/**
 * How the device is connected right now, in the terms the download policy uses.
 *
 * A connection the platform cannot price (VPN, bluetooth, ethernet, an unknown
 * transport) is `other`, and the policy asks before spending it.
 */
async function currentNetwork(): Promise<MapNetwork> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.type === 'wifi') return 'wifi';
  if (state.type === 'cellular') return 'cellular';
  return 'other';
}

/** The regions the preload names, priced and without the ones already on the device. */
function pendingRegions(
  map: NonNullable<ReturnType<typeof useRemoteConfigStore.getState>['config']['map']>,
): MapPrefetchRegion[] {
  // Indexed by name, because the name is what a region's identity resolves to: one
  // lookup per region, and the freshness question is asked of that file alone.
  const downloaded = new Map(
    listDownloadedArchives().map((archive) => [archive.name, archive] as const),
  );

  const pending: MapPrefetchRegion[] = [];
  for (const key of map.download.preload) {
    const region = map.regions[key];
    if (!region) continue;
    const identity = archiveIdentity(region.archiveUrl, key);
    if (!identity) continue;
    const archiveName = archiveFileName(identity);
    // An archive already on the device costs nothing, so it is neither downloaded
    // again nor counted in the total the walker is asked to approve — as long as it
    // is still the artifact the payload advertises. The name carries the version but
    // an artifact can be overwritten in place under it, so the size decides.
    if (
      isArchiveCurrent(downloaded.get(archiveName), {
        name: archiveName,
        bytes: region.archiveBytes,
      })
    ) {
      continue;
    }
    pending.push({
      key,
      label: region.label,
      bytes: region.archiveBytes,
      archiveUrl: region.archiveUrl,
    });
  }
  return pending;
}

/**
 * What the payload identity is: a new payload is the only thing that may ask again.
 *
 * Two renders of the same payload must not download twice, and must not ask twice:
 * the walker answered once. It is recorded when a run actually decides, not when it
 * starts, so a cancelled run (a payload change, or React re-running the effect)
 * leaves the payload unhandled for the run that follows it.
 */
function payloadSignature(map: {
  renderer: string;
  styleUrl: string;
  download: MapDownloadPolicy;
  regions: Record<string, { archiveBytes: number }>;
}): string {
  const prices = Object.entries(map.regions)
    .map(([key, region]) => `${key}:${region.archiveBytes}`)
    .join(',');
  const { preload, autoMaxBytes, cacheMaxBytes, cellular } = map.download;
  return [
    map.renderer,
    map.styleUrl,
    preload.join('+'),
    autoMaxBytes,
    cacheMaxBytes,
    cellular,
    prices,
  ].join('|');
}

export function useMapPrefetch(): MapPrefetchState {
  const map = useRemoteConfigStore((state) => state.config.map);
  const [prompt, setPrompt] = useState<MapPrefetchPrompt | null>(null);
  /** The payload this hook already handled; the ref survives the re-render it causes. */
  const handled = useRef<string | null>(null);

  const signature = map ? payloadSignature(map) : null;

  const download = useCallback(
    (regions: MapPrefetchRegion[], policy: MapDownloadPolicy): Promise<void> =>
      // One at a time, in the order the payload named: these archives compete for the
      // same connection, and every run evicts down to the same budget, so two of them
      // in flight could delete each other's freshly written file. Written as a chain
      // rather than a loop so the sequence is the shape of the code.
      regions.reduce(
        (previous, region) =>
          previous.then(async () => {
            const identity = archiveIdentity(region.archiveUrl, region.key);
            if (!identity) return;
            try {
              await ensureArchiveOnDisk({
                archiveUrl: region.archiveUrl,
                identity,
                cacheMaxBytes: policy.cacheMaxBytes,
              });
            } catch (error) {
              // One region that cannot be fetched must not stop the ones after it, and
              // a map without its archive reports its own error where it is drawn.
              logger.warn('map prefetch could not download a region', error);
            }
          }),
        Promise.resolve(),
      ),
    [],
  );

  useEffect(() => {
    if (!map || !signature || handled.current === signature) return;

    const renderer = resolveMapRenderer(APP_CONFIG.mapRenderer, map.renderer);
    if (renderer !== 'maplibre') {
      handled.current = signature;
      return;
    }

    // A browser has no archive to keep: `expo-file-system` is an unsupported stub
    // there, so the listing below would throw before anything could be priced, and
    // MapLibre GL JS reads the archive over HTTP instead. Nothing to download, and
    // nothing to ask about.
    if (!canKeepMapArchive()) {
      handled.current = signature;
      return;
    }

    const regions = pendingRegions(map);
    if (regions.length === 0) {
      handled.current = signature;
      return;
    }

    const totalBytes = regions.reduce((sum, region) => sum + region.bytes, 0);
    const policy = map.download;

    let cancelled = false;
    void (async () => {
      const network = await currentNetwork();
      if (cancelled) return;

      // Marked only now, once this run is the one that decides: a setup that was
      // cancelled before reaching here — React re-running the effect in development —
      // must not make the payload look handled, or nothing would ever download.
      handled.current = signature;

      const decision = decideDownload({ bytes: totalBytes, network, policy });
      if (decision === 'download') {
        await download(regions, policy);
        return;
      }
      if (decision === 'ask') setPrompt({ regions, totalBytes });
      logger.info('map prefetch did not start', { decision, network, totalBytes });
    })();

    return () => {
      cancelled = true;
    };
  }, [map, signature, download]);

  const accept = useCallback(() => {
    const current = prompt;
    if (!current || !map) return;
    setPrompt(null);
    void download(current.regions, map.download);
  }, [prompt, map, download]);

  const dismiss = useCallback(() => setPrompt(null), []);

  return { prompt, accept, dismiss };
}
