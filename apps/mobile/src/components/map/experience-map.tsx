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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import {
  applyLayerGroups,
  buildReferenceStyleLayers,
  labelAnchorForDocument,
  referenceSourceId,
  withResolvedLabels,
  type MapDocument,
  type MapLayerSelection,
  type MapStyleLayer,
  type TranslateKey,
} from '@sonora/shared';

import LoadingView from '@/components/loading-view';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import {
  useMapArchiveFile,
  type MapArchiveErrorCode,
  type MapArchiveFileState,
} from '@/hooks/use-map-archive-file';
import { useAppTranslation, type TranslationKeys } from '@/hooks/use-translation';
import { fetchStyleDocument, isDrawableStyle } from '@/services/map-style-cache';
import { downloadStyleAssets, localizeStyle } from '@/services/map-styles';
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
 * Stable codes for what can go wrong while the style is fetched. The hook reports one
 * of these and the view translates it, so no sentence a request layer produced is ever
 * drawn on screen for a walker to read.
 */
type MapStyleErrorCode = 'styleTimeout' | 'styleRequestFailed' | 'styleInvalid';

/** Every stable failure code the map screen can render, from either of its two waits. */
type MapLoadErrorCode = MapStyleErrorCode | MapArchiveErrorCode;

/** The sentence each code becomes on screen; the words live here, not in the hooks. */
const ERROR_MESSAGE_KEYS: Record<MapLoadErrorCode, TranslationKeys> = {
  styleTimeout: 'map.errors.styleTimeout',
  styleRequestFailed: 'map.errors.styleUnavailable',
  styleInvalid: 'map.errors.styleUnavailable',
  archiveMissing: 'map.errors.archiveMissing',
  archiveDownloadFailed: 'map.errors.archiveUnavailable',
  archivePublishFailed: 'map.errors.archiveUnavailable',
  archiveEmpty: 'map.errors.archiveInvalid',
  archiveNotPmtiles: 'map.errors.archiveInvalid',
  archiveTruncated: 'map.errors.archiveInvalid',
  archiveVersionUnsupported: 'map.errors.archiveInvalid',
};

/**
 * Style documents already fetched on this page, keyed by url.
 *
 * This is a cache of finished documents and nothing else: it is read once, to prefill
 * the first render of a mount, so a warm page draws immediately. Only a document that
 * can be drawn is ever stored, because whatever is here becomes the map's style on
 * every later visit.
 */
const styles = new Map<string, StyleSpecification>();

/** What one transfer settles to. It never rejects: a failure is an outcome with a code. */
type StyleOutcome =
  { status: 'ready'; style: StyleSpecification } | { status: 'error'; code: MapStyleErrorCode };

/**
 * One transfer of a style document, shared by every run that waits for the same url.
 *
 * A transfer lives here rather than inside the hook because a remount used to cancel
 * the previous run before it could cache anything: every mount started a new request,
 * abandoned it, and the map never received a style. One page, one transfer per url,
 * cancelled by its own bound — and only by it.
 */
interface StyleTransfer {
  readonly promise: Promise<StyleOutcome>;
  readonly controller: AbortController;
}

/** Transfers in flight, keyed by url. */
const styleTransfers = new Map<string, StyleTransfer>();

/**
 * Fetches one style document over a signal this page owns, bounded, and always settles
 * with an outcome instead of rejecting: the code inside it is what the view translates.
 */
function requestStyleDocument(url: string, controller: AbortController): Promise<StyleOutcome> {
  return new Promise<StyleOutcome>((resolve) => {
    let finished = false;
    let bound: ReturnType<typeof setTimeout> | undefined;

    /** Settles this transfer once, and disarms the bound with it. */
    const finish = (outcome: StyleOutcome): void => {
      if (finished) return;
      finished = true;
      if (bound !== undefined) clearTimeout(bound);
      resolve(outcome);
    };

    // The bound cancels the transfer itself, not only this wait: a style request that
    // never answers must stop streaming once the screen has given up on it.
    bound = setTimeout(() => {
      controller.abort();
      finish({ status: 'error', code: 'styleTimeout' });
    }, STYLE_TIMEOUT_MS);

    // The document travels through the client's cache (`map-style-cache.ts`), exactly as
    // it does on the web renderer: a successful fetch is what every later cold start
    // reads, and a failed one is answered from that store before it is reported. So this
    // page keeps no document of its own on the filesystem: the only I/O a style costs
    // here is the asset pass in `resolveStyleOutcome`.
    fetchStyleDocument(url, { signal: controller.signal })
      .then((body) => {
        // A 200 carrying an error document must fail here: whatever the cache stored is
        // handed to the map as its style on every later visit, with no failure to see.
        if (!isDrawableStyle<StyleSpecification>(body)) {
          finish({ status: 'error', code: 'styleInvalid' });
          return;
        }
        finish({ status: 'ready', style: body });
      })
      .catch((error: unknown) => {
        // A cancelled transfer has nobody left to report to; a real failure keeps its
        // detail in the log, because the screen only ever shows the code.
        if (!controller.signal.aborted) logger.warn('map style request failed', error);
        finish({ status: 'error', code: 'styleRequestFailed' });
      });
  });
}

/**
 * The style this run draws: the document the transfer settled on — the network's answer,
 * or the client's cache when the network could not answer — with its asset urls pointed
 * at the device when the files are really there.
 *
 * The document needs nothing more from this page. The client stored it on success and
 * answered from that store on failure, which is R12 (a cold start with no network draws
 * the map the walker last saw) with one copy of the bytes instead of two. What is left is
 * the asset pass — the font ranges and the sprite MapLibre reads as real paths — run
 * again even for a cached document, because a previous run's transfers may have been
 * interrupted. Deliberately not awaited: the draw does not wait for files a *later* cold
 * start reads, and a failure there is a log line, never a map that went away.
 */
async function resolveStyleOutcome(outcome: StyleOutcome): Promise<StyleOutcome> {
  if (outcome.status !== 'ready') return outcome;

  void downloadStyleAssets(outcome.style).catch((error: unknown) => {
    logger.warn('map style assets could not be cached', error);
  });
  return { status: 'ready', style: await localizeStyle(outcome.style) };
}

/** Starts this page's transfer of `url`, owned by the run that calls this. */
function startStyleTransfer(url: string): StyleTransfer {
  const controller = new AbortController();
  // A document the page already holds is not fetched again: the transfer settles at
  // once, which is how a style url that changes to a warm document still draws without
  // a request. The mount-time prefill covers the common case before this runs.
  const cached = styles.get(url);
  const settled = cached
    ? Promise.resolve<StyleOutcome>({ status: 'ready', style: cached })
    : requestStyleDocument(url, controller);

  const transfer: StyleTransfer = {
    controller,
    promise: settled
      .then(resolveStyleOutcome)
      .then((outcome) => {
        // Only a document that can be drawn is cached: the cache is what the first
        // render of every later mount draws from.
        if (outcome.status === 'ready') styles.set(url, outcome.style);
        return outcome;
      })
      .finally(() => {
        // A newer transfer of the same url may already have replaced this entry.
        if (styleTransfers.get(url) === transfer) styleTransfers.delete(url);
      }),
  };
  styleTransfers.set(url, transfer);
  return transfer;
}

/**
 * The transfer `url` already has, or a new one for this run.
 *
 * A run that finds a transfer in flight for the same url joins it instead of starting a
 * second one, which is what keeps a remount from paying for a request the page has
 * already made — that is the whole point of the single flight, so an effect cleanup
 * never cancels it. Nothing here has to ask whether a transfer is still alive: its own
 * bound aborts it and settles it, and the `finally` in {@link startStyleTransfer} drops
 * the entry as it settles, so an entry that exists is an entry still worth waiting for.
 */
function acquireStyleTransfer(url: string): StyleTransfer {
  return styleTransfers.get(url) ?? startStyleTransfer(url);
}

/** The base style the reference layers are drawn over. */
interface BaseStyleState {
  status: 'loading' | 'ready' | 'error';
  style?: StyleSpecification;
  /** The stable code of a failed run, translated where the screen shows it. */
  error?: MapStyleErrorCode;
}

/** What one run settled, and which run — `url` plus `attempt` — it belongs to. */
interface StyleSettlement {
  url: string;
  attempt: number;
  outcome: StyleOutcome;
}

/**
 * Fetches the style document the remote config points at. The native map cannot read
 * the archive's own TileJSON into a style the way the web renderer does, so the base
 * layers (and the glyphs a label layer needs) come from this document. A failed fetch
 * fails loudly: an empty canvas would look like a working map.
 *
 * The outcome lives in React state keyed by `url` and `attempt`; the page registry is
 * read only to prefill the first render of a mount. Nothing else in the render derives
 * the status, which is what the device needed: deriving it from module-scope mutable
 * state that React does not track left the screen on `loading` for a document that had
 * already arrived, while this hook's own effect — one commit later, on the same key —
 * saw it. A patched cache read cannot fix that; one render decision needs one source.
 *
 * The effect has no cleanup on purpose. The transfer belongs to the page, so a remount
 * adopts the request the page already sent instead of paying a second one, and the
 * bound — which cancels the transfer and settles it — is what a request nobody comes
 * back for is left to. A retry still starts fresh, because the entry is dropped as its
 * transfer settles.
 *
 * `attempt` is what a retry bumps: it restarts the transfer and identifies its own
 * settled result, so the failure of the attempt that was given up never answers for
 * the new one.
 */
function useRemoteStyle(styleUrl: string | undefined, attempt: number): BaseStyleState {
  const [settled, setSettled] = useState<StyleSettlement | null>(() => {
    const cached = styleUrl ? styles.get(styleUrl) : undefined;
    if (!styleUrl || !cached) return null;
    return { url: styleUrl, attempt, outcome: { status: 'ready', style: cached } };
  });

  useEffect(() => {
    if (!styleUrl) return;
    // This run already settled: there is nothing to wait for, and re-arming is what
    // made one observation permanent before (`styles.has` short-circuited the effect,
    // so a key that existed but could not be drawn was never fetched again).
    if (settled?.url === styleUrl && settled.attempt === attempt) return;

    const transfer = acquireStyleTransfer(styleUrl);

    // No cleanup and no cancellation here: the settlement is keyed by `url` and
    // `attempt`, so a result that arrives after this run stopped being the current one
    // is ignored by the render instead of having to be withdrawn.
    transfer.promise.then((outcome) => {
      setSettled({ url: styleUrl, attempt, outcome });
    });
  }, [styleUrl, attempt, settled]);

  if (!styleUrl) return { status: 'ready' };
  // A settled outcome for another style — or for another attempt of this one — says
  // nothing about this run.
  if (settled?.url !== styleUrl || settled.attempt !== attempt) return { status: 'loading' };
  return settled.outcome.status === 'ready'
    ? { status: 'ready', style: settled.outcome.style }
    : { status: 'error', error: settled.outcome.code };
}

/**
 * Which wait is pending while the map cannot draw yet.
 *
 * The archive is a file on the device and the style is one request, so naming the
 * stalled stage is what turns a screenshot of this screen into a diagnosis. A
 * point that belongs to no region never waits for an archive.
 */
/** Which wait is still pending, or `null` when the map can draw. */
function pendingWait(input: {
  noRegion: boolean;
  hasArchive: boolean;
  remote: BaseStyleState;
  hasStyle: boolean;
}): 'archive' | 'style' | null {
  if (!input.noRegion && !input.hasArchive) return 'archive';
  if (input.remote.status === 'loading' || !input.hasStyle) return 'style';
  return null;
}

/**
 * The failure this map would report, if any.
 *
 * A point outside every region has no archive on purpose, so `archiveMissing` is not
 * a failure there, and the remote style is not drawn either, so a style that failed
 * is not one there either — the honest line says what is happening instead. Every
 * other reason (a download that failed, a damaged file, a style that never arrived
 * for a map that needs it) is still reported.
 */
function failureCode(input: {
  noRegion: boolean;
  archive: MapArchiveFileState;
  remote: BaseStyleState;
}): MapLoadErrorCode | undefined {
  if (input.noRegion) return undefined;
  if (input.archive.status === 'error') return input.archive.error;
  return input.remote.status === 'error' ? input.remote.error : undefined;
}

/**
 * The style drawn when the experience belongs to no published region: no basemap at
 * all, so the reference plane is the whole map. Deliberately not the remote style —
 * its `basemap` points at an archive this device never downloaded, and a canvas that
 * fails to fetch tiles looks broken instead of saying the truth.
 */
function referencePlaneStyle(): StyleSpecification {
  return { version: 8, sources: {}, layers: [] };
}

function pendingStageKey(archivePending: boolean): TranslationKeys {
  return archivePending ? 'map.loadingArchive' : 'map.loadingStyle';
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

/** The selection a caller who decided nothing hands over: no group is declared. */
const NO_LAYER_SELECTION: readonly MapLayerSelection[] = [];

/**
 * Draw order and uniqueness, matching what `applyMapDocuments` reconciles on the web.
 */
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
 * The selection as one comparable value: a group, whether it draws, and whether the
 * payload (or the walker) named it.
 *
 * The array is not an input. The switch keeps it in state, so its identity is stable
 * today, but a caller that rebuilds it per render must still not rebuild the style:
 * on native a new style object re-applies the style and re-fetches its tiles.
 */
function selectionSignature(selection: readonly MapLayerSelection[]): string {
  return selection
    .map((entry) => `${entry.id}:${entry.visible ? 1 : 0}:${entry.declared ? 1 : 0}`)
    .join(',');
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
    /** Absent when the point belongs to no region: there is no basemap to draw. */
    archiveUri?: string;
    documents: readonly MapDocument[];
    /** Which basemap groups draw, resolved once by the view. */
    selection: readonly MapLayerSelection[];
    showLabels: boolean;
    translate: TranslateKey;
  },
): StyleSpecification {
  const { archiveUri, documents, selection, showLabels, translate } = options;
  // A label layer is a symbol layer: without a glyphs source MapLibre fails to
  // draw it, so labels only exist when the base style can serve them.
  const includeLabels = showLabels && Boolean(base.glyphs);
  const basemap = base.sources?.basemap as VectorSourceSpecification | undefined;

  const sources: Record<string, unknown> = {
    ...base.sources,
    // The archive is a file on the device: its transport url replaces the remote
    // one the style was authored with, exactly as the web renderer swaps in its
    // in-memory one. Without an archive there is no basemap at all.
    ...(archiveUri ? { basemap: { ...basemap, type: 'vector', url: archiveUri } } : {}),
  };

  // The groups are applied to the basemap's own layers, before any document layer
  // is appended: our references are not a basemap group and no group may blank them.
  // The transform is pure, so this stays a declarative rebuild of the style.
  const layers: MapStyleLayer[] = applyLayerGroups(
    [...(base.layers ?? [])] as unknown as MapStyleLayer[],
    selection,
  );

  for (const document of orderedDocuments(documents)) {
    const sourceId = referenceSourceId(document.key);
    sources[sourceId] = {
      type: 'geojson',
      data: withResolvedLabels(document, translate).collection,
    };
    layers.push(
      ...buildReferenceStyleLayers(sourceId, {
        includeLabels,
        labelAnchor: labelAnchorForDocument(document.key),
      }),
    );
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
  layerSelection = NO_LAYER_SELECTION,
  onFeaturePress,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: ExperienceMapProps) {
  const { t, language } = useAppTranslation();
  /**
   * The experience belongs to no published region: there is no archive to draw, and
   * that is a fact about the place, not a failure to report. `null` is the resolved
   * answer — an absent key means the caller never resolved one, which is not the same
   * thing and keeps the archive-missing error for a map that really lost its archive.
   */
  const noRegion = source.regionKey === null;
  // One counter per wait, so the retry never restarts a wait that did not fail.
  const [archiveAttempt, setArchiveAttempt] = useState(0);
  const [styleAttempt, setStyleAttempt] = useState(0);
  const archive = useMapArchiveFile(source, archiveAttempt);
  const remote = useRemoteStyle(source.styleUrl, styleAttempt);
  const mapRef = useRef<MapRef>(null);

  const retry = useCallback(() => {
    if (archive.status === 'error') setArchiveAttempt((previous) => previous + 1);
    if (remote.status === 'error') setStyleAttempt((previous) => previous + 1);
  }, [archive.status, remote.status]);

  const [centerLng, centerLat] = center;

  // The style is built from values, never from the identity of the props that
  // carry them: the switch hands a rebuilt `overlays` array (and a rebuilt
  // itinerary document) and the translation hook a new `t` on every render. The
  // selection is an input by content for the same reason, even though the view
  // keeps it in state: a caller that rebuilds the array per render must not rebuild
  // the style.
  const documentsKey = documentsSignature(overlays);
  const selectionKey = selectionSignature(layerSelection);
  // The basemap is the region's archive and nothing else: with no region there is
  // no archive to draw, whatever the hook happens to hand back.
  const archiveUri = !noRegion && archive.status === 'ready' ? archive.uri : undefined;
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
    // Without a region the reference plane is the whole map: an archive nobody
    // downloaded is not a style to draw, so neither the remote style nor the inline
    // one is used — both carry a basemap this device cannot serve.
    if (noRegion) {
      return buildMapStyle(referencePlaneStyle(), {
        documents: overlays,
        selection: layerSelection,
        showLabels,
        translate,
      });
    }
    if (!archiveUri) return null;
    return buildMapStyle(styleDocument ?? fallbackStyle(archiveUri, attribution), {
      archiveUri,
      documents: overlays,
      selection: layerSelection,
      showLabels,
      translate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the documents and the selection are inputs by content (`documentsKey`, `selectionKey`), not by array identity
  }, [
    archiveUri,
    noRegion,
    styleDocument,
    attribution,
    showLabels,
    translate,
    documentsKey,
    selectionKey,
  ]);

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

  const failure = failureCode({ noRegion, archive, remote });

  if (failure) {
    return (
      <TwView
        testID={`${testID}-error`}
        className={`${className} items-center justify-center gap-2 bg-backgroundElement px-4`}
      >
        <ThemedText>{t('map.offlineTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {/* Both waits report a code; the sentence is ours and it is translated here,
              so no English text from a request or from the filesystem reaches the screen. */}
          {failure ? t(ERROR_MESSAGE_KEYS[failure]) : t('map.offlineDescription')}
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
  // covers: nothing can be drawn over an archive that does not exist yet. A point
  // with no region waits for no archive, so only the style can still be pending.
  const pending = pendingWait({
    noRegion,
    hasArchive: Boolean(archiveUri),
    remote,
    hasStyle: Boolean(style),
  });
  if (pending) {
    return (
      <TwView testID={testID} className={className}>
        <LoadingView message={t(pendingStageKey(pending === 'archive'))} />
      </TwView>
    );
  }

  // Every path that yields no style is covered by the guards above; this keeps the
  // type honest instead of asserting it away.
  if (!style) return null;

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
      {/* One honest line over the reference plane: the map is not broken, this place
          is outside the regions the app publishes. */}
      {noRegion && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          className="absolute bottom-0 left-0 right-0 bg-backgroundElement px-3 py-2 text-center"
          testID={`${testID}-no-region`}
        >
          {t('map.noRegion')}
        </ThemedText>
      )}
    </TwView>
  );
}
