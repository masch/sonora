import type {
  CameraBoundsStop,
  CameraCenterStop,
  LngLat,
  MapRef,
  PixelPointBounds,
  PressEvent,
  PressEventWithFeatures,
  StyleSpecification,
  VectorSourceSpecification,
} from '@maplibre/maplibre-react-native';
import { Camera, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import {
  buildReferenceStyleLayers,
  referenceSourceId,
  withResolvedLabels,
  type MapDocument,
  type MapStyleLayer,
  type TranslateKey,
} from '@sonora/shared';

import LoadingView from '@/components/loading-view';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { useMapArchiveFile, type MapArchiveFileState } from '@/hooks/use-map-archive-file';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { TwView } from '@/tw';
import { logger } from '@/utils/logger';

import {
  documentKeyOfLayer,
  type ExperienceMapProps,
  type MapReferencePress,
} from './map-view.types';

/** Press target around the tapped point, in pixels: the 44x44 a pressable source uses. */
const HITBOX_PIXELS = 22;

/**
 * How long one run may wait for the style document before it reports the style as
 * the stage that stalled. Shorter than the archive's bound on purpose: the style is
 * a small JSON document, so silence here is a failure long before a minute is up,
 * and a map that never draws is worse than one that says it could not.
 */
const STYLE_TIMEOUT_MS = 10 * 1000;

/**
 * What the caller is told when the style request outlives the bound. It names the
 * stage, so the two waits behind the same spinner are tellable apart.
 */
const STYLE_TIMEOUT_MESSAGE = 'the map style did not load';

/** Style documents already fetched, keyed by url: a style is fetched once per page. */
const styles = new Map<string, StyleSpecification>();

/**
 * Style requests in flight, keyed by url.
 *
 * A request lives here rather than in the hook because a remount used to cancel the
 * previous run before it could cache anything: every mount started a new request,
 * abandoned it, and the map never received a style. One page, one request per url.
 */
const styleRequests = new Map<string, Promise<StyleSpecification>>();

// TEMP MAP TRACE — remove before merge (odd/tasks/map-offline-references.md, L44).
// The first visit to a trip never leaves the style spinner while the second is
// instant, and no code path explains it, so the screen has to report its own
// sequence: how many times this module rendered and mounted, what the request did
// and whether the render could see the cache. One screenshot then names the cause.
const mapTrace = {
  mounts: 0,
  renders: 0,
  settles: 0,
  dropped: 0,
  request: 'none',
  write: 'none',
  read: 'none',
};

/** TEMP MAP TRACE (remove before merge): the seconds this screen has been waiting. */
function useMapTraceSeconds(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    mapTrace.mounts += 1;
    const tick = setInterval(() => setSeconds((previous) => previous + 1), 1000);
    return () => clearInterval(tick);
  }, []);
  // Counted after each commit: a growing number proves the screen still renders.
  useEffect(() => {
    mapTrace.renders += 1;
  });
  return seconds;
}

/** TEMP MAP TRACE (remove before merge): what the wait looks like from this render. */
function MapTraceLine(props: {
  testID: string;
  seconds: number;
  cached: boolean;
  remoteStatus: string;
  archiveStatus: string;
  styleBuilt: boolean;
  documentKnown: boolean;
  archiveUri: boolean;
}): ReactElement {
  const {
    testID,
    seconds,
    cached,
    remoteStatus,
    archiveStatus,
    styleBuilt,
    documentKnown,
    archiveUri,
  } = props;
  const request = `req:${mapTrace.request}`;
  return (
    <ThemedText testID={testID} type="small" themeColor="textSecondary">
      {`trace ${seconds}s r${mapTrace.renders} m${mapTrace.mounts} ${request} settled:${mapTrace.settles} dropped:${mapTrace.dropped} cache:${cached ? 'hit' : 'miss'} remote:${remoteStatus} archive:${archiveStatus} write:${mapTrace.write} read:${mapTrace.read} uri:${archiveUri ? 'y' : 'n'} doc:${documentKnown ? 'y' : 'n'} style:${styleBuilt ? 'y' : 'n'}`}
    </ThemedText>
  );
}

/** Fetches a style once per url, with a bound that no remount can cancel. */
function requestStyle(url: string): Promise<StyleSpecification> {
  const inFlight = styleRequests.get(url);
  if (inFlight) return inFlight;

  mapTrace.request = 'pending';

  const request = new Promise<StyleSpecification>((resolve, reject) => {
    const bound = setTimeout(() => {
      mapTrace.request = 'timeout';
      reject(new Error(STYLE_TIMEOUT_MESSAGE));
    }, STYLE_TIMEOUT_MS);

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`style ${response.status} ${response.statusText}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .then((style) => {
        clearTimeout(bound);
        mapTrace.request = 'resolved';
        styles.set(url, style);
        // TEMP MAP TRACE — remove before merge: what actually landed in the cache.
        mapTrace.write = `${style ? 'obj' : String(style)} size:${styles.size} key:${url.slice(-10)}`;
        resolve(style);
      })
      .catch((error: unknown) => {
        clearTimeout(bound);
        mapTrace.request = `rejected:${error instanceof Error ? error.message : 'unknown'}`;
        reject(error);
      });
  }).finally(() => {
    styleRequests.delete(url);
  });

  styleRequests.set(url, request);
  return request;
}

/** The base style the reference layers are drawn over. */
interface BaseStyleState {
  status: 'loading' | 'ready' | 'error';
  style?: StyleSpecification;
  error?: string;
}

/**
 * Fetches the style document the remote config points at. The native map cannot
 * read the archive's own TileJSON into a style the way the web renderer does, so
 * the base layers (and the glyphs a label layer needs) come from this document.
 * A failed fetch fails loudly: an empty canvas would look like a working map.
 *
 * The wait is bounded, so a request that never answers becomes an error the screen
 * can show instead of a spinner that never ends, and `attempt` is what a retry
 * bumps: it restarts the request and identifies its own settled result, so the
 * failure of the attempt that was given up never answers for the new one.
 */
function useRemoteStyle(styleUrl: string | undefined, attempt: number): BaseStyleState {
  // `url` and `attempt` mark which run the settled outcome belongs to; the style
  // itself is read back out of the page registry below, so this state never holds a
  // document for a url that is no longer configured.
  const [settled, setSettled] = useState<{
    url: string;
    attempt: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!styleUrl || styles.has(styleUrl)) return;

    let cancelled = false;

    requestStyle(styleUrl)
      .then(() => {
        mapTrace.settles += 1;
        if (cancelled) {
          mapTrace.dropped += 1;
          return;
        }
        setSettled({ url: styleUrl, attempt });
      })
      .catch((error: unknown) => {
        mapTrace.settles += 1;
        if (cancelled) {
          mapTrace.dropped += 1;
          return;
        }
        setSettled({
          url: styleUrl,
          attempt,
          error: error instanceof Error ? error.message : 'style request failed',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [styleUrl, attempt]);

  // TEMP MAP TRACE — remove before merge: the same derivation, with what this render saw.
  let next: BaseStyleState;
  if (!styleUrl) {
    next = { status: 'ready' };
  } else {
    const cached = styles.get(styleUrl);
    if (cached) {
      next = { status: 'ready', style: cached };
    } else if (settled?.url !== styleUrl || settled.attempt !== attempt || !settled.error) {
      next = { status: 'loading' };
    } else {
      next = { status: 'error', error: settled.error };
    }
  }
  // Recorded after the commit, so the render itself stays free of side effects.
  useEffect(() => {
    mapTrace.read = `${next.status} has:${styleUrl && styles.has(styleUrl) ? 'y' : 'n'} get:${
      styleUrl && styles.get(styleUrl) ? 'obj' : 'none'
    } seen:${settled ? 'y' : 'n'} at:${settled?.attempt ?? '-'}/${attempt} size:${styles.size}`;
  });
  return next;
}

/**
 * Which wait is pending while the map cannot draw yet.
 *
 * The archive is a file on the device and the style is one request, so naming the
 * stalled stage is what turns a screenshot of this screen into a diagnosis.
 */
function pendingStageKey(archive: MapArchiveFileState): TranslationKeys {
  return archive.status !== 'ready' || !archive.uri ? 'map.loadingArchive' : 'map.loadingStyle';
}

/**
 * The style drawn when neither the caller nor the remote config provides one: the
 * archive on disk with no base layers, so the reference documents are still drawn.
 */
function fallbackStyle(archiveUri: string, attribution: string | undefined): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'vector',
        url: archiveUri,
        ...(attribution ? { attribution } : {}),
      },
    },
    layers: [],
  };
}

/** Draw order and uniqueness, matching what `applyMapDocuments` reconciles on the web. */
function orderedDocuments(documents: readonly MapDocument[]): MapDocument[] {
  const ordered = [...documents].sort(
    (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0) || left.key.localeCompare(right.key),
  );
  const unique = new Map<string, MapDocument>();
  for (const document of ordered) unique.set(document.key, document);
  return [...unique.values()];
}

/**
 * The drawable content of the documents as one comparable value: key, version,
 * draw order and the collection itself. The array and the document objects are not
 * inputs — the switch rebuilds them on every render, and on native a new style
 * makes MapLibre re-apply the style and re-fetch its tiles.
 *
 * The collection is part of the signature because not every document is versioned:
 * the itinerary the switch derives carries none, and its content is exactly what
 * changes when the walker moves.
 */
function documentsSignature(documents: readonly MapDocument[]): string {
  return documents
    .map(
      (document) =>
        `${document.key}@${document.version ?? 0}:${document.zIndex ?? 0}:${JSON.stringify(document.collection)}`,
    )
    .sort()
    .join('|');
}

/**
 * Reads a reportable reference out of a tapped feature. The web renderer has the
 * same mapping (`toPressReference` in `experience-map.web.tsx`, fed by
 * `feature.layer.id`); native presses carry no layer id, so the layer that was
 * queried stands in for it and both builds emit the same `MapReferencePress`.
 */
function toPressReference(
  layerId: string,
  properties: Record<string, unknown>,
): MapReferencePress | null {
  const documentKey = documentKeyOfLayer(layerId);
  if (!documentKey) return null;

  const reference: MapReferencePress = { documentKey };
  if (typeof properties.label === 'string') reference.label = properties.label;
  if (typeof properties.labelKey === 'string') reference.labelKey = properties.labelKey;
  if (typeof properties.descriptionKey === 'string') {
    reference.descriptionKey = properties.descriptionKey;
  }
  if (typeof properties.imageUrl === 'string') reference.imageUrl = properties.imageUrl;
  if (typeof properties.linkUrl === 'string') reference.linkUrl = properties.linkUrl;
  return reference;
}

/**
 * The reference documents as style sources and layers, over the base style.
 *
 * Both renderers build this from the same shared module: the archive on disk is
 * the basemap's source, every document is a GeoJSON source drawn by
 * `buildReferenceStyleLayers`, and labels are resolved before drawing because
 * MapLibre cannot call the translation layer.
 */
function buildMapStyle(
  base: StyleSpecification,
  options: {
    archiveUri: string;
    documents: readonly MapDocument[];
    showLabels: boolean;
    translate: TranslateKey;
  },
): StyleSpecification {
  const { archiveUri, documents, showLabels, translate } = options;
  // A label layer is a symbol layer: without a glyphs source MapLibre fails to
  // draw it, so labels only exist when the base style can serve them.
  const includeLabels = showLabels && Boolean(base.glyphs);
  const basemap = base.sources?.basemap as VectorSourceSpecification | undefined;

  const sources: Record<string, unknown> = {
    ...base.sources,
    // The archive is a file on the device: its transport url replaces the remote
    // one the style was authored with, exactly as the web renderer swaps in its
    // in-memory one.
    basemap: { ...basemap, type: 'vector', url: archiveUri },
  };

  const layers: MapStyleLayer[] = [...(base.layers ?? [])] as unknown as MapStyleLayer[];

  for (const document of orderedDocuments(documents)) {
    const sourceId = referenceSourceId(document.key);
    sources[sourceId] = {
      type: 'geojson',
      data: withResolvedLabels(document, translate).collection,
    };
    layers.push(...buildReferenceStyleLayers(sourceId, { includeLabels }));
  }

  // The shared builder types `filter` as `unknown[]` because it has no dependency
  // on the style spec; this cast is where the two declarations meet.
  return { ...base, sources, layers } as StyleSpecification;
}

/**
 * MapLibre Native map: the base vector tiles read from the PMTiles archive the
 * app downloaded to disk, plus the reference documents the experiences payload
 * delivers, drawn by the same shared style builder the web renderer uses.
 *
 * The map is declarative: the whole style (base layers, one GeoJSON source per
 * document and their layers) is rebuilt when any of its inputs changes, and the
 * object handed to `Map` only changes then: on native a new `mapStyle` re-applies
 * the style and re-fetches its tiles, so a re-render must not produce one.
 *
 * `userCoordinates` and `waypoints` are accepted for the shared contract and not
 * read here: the switch already encodes both in the itinerary document it hands
 * over as an overlay, so drawing them twice would double the marker.
 */
export default function ExperienceMap({
  source,
  overlays,
  bounds,
  center = [-64.738, -32.212],
  zoom = 14,
  showLabels = true,
  onFeaturePress,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: ExperienceMapProps) {
  const { t, language } = useAppTranslation();
  // TEMP MAP TRACE — remove before merge.
  const traceSeconds = useMapTraceSeconds();
  // One counter per wait, so the retry never restarts a wait that did not fail.
  const [archiveAttempt, setArchiveAttempt] = useState(0);
  const [styleAttempt, setStyleAttempt] = useState(0);
  const archive = useMapArchiveFile(source.archiveUrl || undefined, archiveAttempt);
  const remote = useRemoteStyle(source.styleUrl, styleAttempt);
  const mapRef = useRef<MapRef>(null);

  const retry = useCallback(() => {
    if (archive.status === 'error') setArchiveAttempt((previous) => previous + 1);
    if (remote.status === 'error') setStyleAttempt((previous) => previous + 1);
  }, [archive.status, remote.status]);

  const [centerLng, centerLat] = center;

  // The style is built from values, never from the identity of the props that
  // carry them: the switch hands a rebuilt `overlays` array (and a rebuilt
  // itinerary document) and the translation hook a new `t` on every render.
  const documentsKey = documentsSignature(overlays);
  const archiveUri = archive.status === 'ready' ? archive.uri : undefined;
  const styleDocument =
    (source.style as unknown as StyleSpecification | undefined) ??
    (remote.status === 'ready' ? remote.style : undefined);
  const attribution = source.attribution;

  /**
   * The translation layer as the shared style builder takes it. `t` is read from
   * this render and deliberately left out of the deps: a re-render hands over a
   * new wrapper, while the language is what changes the text. The identity is
   * therefore stable until the language changes, and the style with it.
   */
  const translate = useMemo<TranslateKey>(
    () => (key, options) => t(key as never, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is taken from the newest render; the language is the input
    [language],
  );

  const style = useMemo<StyleSpecification | null>(() => {
    if (!archiveUri) return null;
    return buildMapStyle(styleDocument ?? fallbackStyle(archiveUri, attribution), {
      archiveUri,
      documents: overlays,
      showLabels,
      translate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the documents are an input by content (`documentsKey`), not by array identity
  }, [archiveUri, styleDocument, attribution, showLabels, translate, documentsKey]);

  /** Layer ids one of the drawn documents owns, in draw order. */
  const referenceLayerIds = useMemo(
    () =>
      (style?.layers ?? [])
        .map((layer) => layer.id)
        .filter((layerId) => documentKeyOfLayer(layerId) !== null),
    [style],
  );

  /**
   * Reports the tapped reference to the caller. A native press carries no layer
   * id, so the hit test is asked once per reference layer, topmost first (the
   * layer drawn last covers the ones below it), over the same 44x44 target a
   * pressable source uses.
   */
  const reportPress = useCallback(
    async (event: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>): Promise<void> => {
      const handler = onFeaturePress;
      const map = mapRef.current;
      if (!handler || !map) return;

      const [x, y] = event.nativeEvent.point;
      const target: PixelPointBounds = [
        [x - HITBOX_PIXELS, y - HITBOX_PIXELS],
        [x + HITBOX_PIXELS, y + HITBOX_PIXELS],
      ];

      for (const layerId of [...referenceLayerIds].reverse()) {
        let features: { properties?: Record<string, unknown> | null }[];
        try {
          features = await map.queryRenderedFeatures(target, { layers: [layerId] });
        } catch (error) {
          logger.error('ExperienceMap could not query the pressed layers:', error);
          return;
        }

        const hit = features[0];
        if (!hit) continue;

        const reference = toPressReference(
          layerId,
          (hit.properties ?? {}) as Record<string, unknown>,
        );
        if (reference) handler(reference);
        return;
      }
    },
    [onFeaturePress, referenceLayerIds],
  );

  if (archive.status === 'error' || remote.status === 'error') {
    return (
      <TwView
        testID={`${testID}-error`}
        className={`${className} items-center justify-center gap-2 bg-backgroundElement px-4`}
      >
        <ThemedText>{t('map.offlineTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {archive.error ?? remote.error ?? t('map.offlineDescription')}
        </ThemedText>
        {/* Each wait starts over on its own, so the other one is never thrown away. */}
        <Button
          label={t('common.retry')}
          accessibilityLabel={t('common.retry')}
          testID="experience-map-retry"
          variant="primary"
          size="sm"
          onPress={retry}
        />
      </TwView>
    );
  }

  // `style` is only absent while the archive is not ready, which the same guard
  // covers: nothing can be drawn over an archive that does not exist yet.
  if (archive.status !== 'ready' || !archive.uri || remote.status === 'loading' || !style) {
    return (
      <TwView testID={testID} className={className}>
        <LoadingView message={t(pendingStageKey(archive))} />
        {/* TEMP MAP TRACE — remove before merge. */}
        <MapTraceLine
          testID={`${testID}-trace`}
          seconds={traceSeconds}
          cached={styles.has(source.styleUrl ?? '')}
          remoteStatus={remote.status}
          archiveStatus={archive.status}
          styleBuilt={style !== null}
          documentKnown={styleDocument !== undefined}
          archiveUri={Boolean(archiveUri)}
        />
      </TwView>
    );
  }

  const camera: Partial<CameraCenterStop & CameraBoundsStop> = bounds
    ? { bounds: [bounds.west, bounds.south, bounds.east, bounds.north] }
    : { center: [centerLng, centerLat] as LngLat, zoom };

  return (
    <TwView testID={testID} className={className}>
      <MapLibreMap
        ref={mapRef}
        mapStyle={style}
        onPress={reportPress}
        // The label describes the map itself: the loading key would be announced by
        // a screen reader over a map that has already drawn.
        accessibilityLabel={t('map.mapLabel')}
        testID={`${testID}-map`}
      >
        <Camera {...camera} />
      </MapLibreMap>
    </TwView>
  );
}
