import 'maplibre-gl/dist/maplibre-gl.css';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MAPLIBRE_LAYER_CAPABILITIES,
  applyMapDocuments,
  layerSelectionSignature,
  resolveLayerSelection,
  withResolvedLabels,
  type MapDocument,
  type MapLayerSelection,
} from '@sonora/shared';

import LoadingView from '@/components/loading-view';
import MapErrorView from './map-error-view';
import { ThemedText } from '@/components/themed-text';
import { useMapSource } from '@/hooks/use-map-source';
import { applyLayerSelection } from './web-layer-visibility';

import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';
import { logger } from '@/utils/logger';

import {
  documentKeyOfLayer,
  FOCUS_DURATION_MS,
  FOCUS_MIN_ZOOM,
  stageOfFailure,
  type ExperienceMapProps,
  type MapLoadErrorCode,
  type MapReferencePress,
} from './map-view.types';
import { useMapFocusFlight } from './use-map-focus-flight';
import { useWebMapInstance, type MapHandle, type RenderedFeature } from './use-web-map-instance';

/** No selection at all: no group is declared, so the style draws what it authored. */
const NO_LAYER_SELECTION: readonly MapLayerSelection[] = [];

function toPressReference(
  layerId: string,
  properties: Record<string, unknown>,
): MapReferencePress | null {
  const documentKey = documentKeyOfLayer(layerId);
  if (!documentKey) return null;

  const reference: MapReferencePress = { documentKey };
  if (typeof properties.experienceSlug === 'string') {
    reference.experienceSlug = properties.experienceSlug;
  }
  if (typeof properties.labelText === 'string') reference.labelText = properties.labelText;
  if (typeof properties.labelKey === 'string') reference.labelKey = properties.labelKey;
  if (typeof properties.descriptionText === 'string') {
    reference.descriptionText = properties.descriptionText;
  }
  if (typeof properties.descriptionKey === 'string') {
    reference.descriptionKey = properties.descriptionKey;
  }
  if (typeof properties.imageUrl === 'string') reference.imageUrl = properties.imageUrl;
  if (typeof properties.linkUrl === 'string') reference.linkUrl = properties.linkUrl;
  return reference;
}

/**
 * MapLibre GL map for the web build. The native build has its own declarative
 * implementation; both consume the same documents and the same style builder
 * from `@sonora/shared`, so a reference is only ever authored once.
 *
 * The style comes from the remote config or from the archive; when neither is
 * configured the map draws the reference documents over an empty canvas.
 *
 * The map instance itself lives in `useWebMapInstance`, which creates it once per
 * source and camera; everything that can change without one — the documents, the
 * layer selection, the camera's flights — is applied to that instance here.
 */
export default function ExperienceMap({
  source,
  overlays,
  bounds,
  center = [-64.738, -32.212],
  zoom = 14,
  showLabels = true,
  layerSelection,
  focus,
  onFocusSettled,
  onFeaturePress,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: ExperienceMapProps) {
  const { t, language, translateKey } = useAppTranslation();
  /**
   * The experience belongs to no published region: there is no archive to draw, and
   * that is a fact about the place, not a failure to report. `null` is the resolved
   * answer; an absent key means the caller never resolved one.
   */
  const noRegion = source.regionKey === null;
  // One counter per wait, so the retry never restarts a wait that did not fail. The hook
  // takes one run number because the two waits are one load: a restart reuses whatever
  // the other wait already settled — the archive from the page registry, the style from
  // the same registry — so the wait that did not fail is not paid for twice.
  const [archiveAttempt, setArchiveAttempt] = useState(0);
  const [styleAttempt, setStyleAttempt] = useState(0);
  /** The map's own build: a failure there is not a wait, so it has a counter of its own. */
  const [mapAttempt, setMapAttempt] = useState(0);
  // The archive is downloaded whole and its tiles are read from memory: the route
  // that serves the bucket supports no byte ranges.
  const archive = useMapSource(source.archiveUrl, source.styleUrl, archiveAttempt + styleAttempt);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const overlaysRef = useRef(overlays);
  /** Labels need a glyphs source; a style without one must not get a label layer. */
  const glyphsAvailableRef = useRef(false);
  /** Read inside `applyOverlays`, which is stable, so toggling never rebuilds the map. */
  const showLabelsRef = useRef(showLabels);
  const translateRef = useRef(translateKey);
  /** Read inside `applyOverlays`: a self-contained reference draws its own text. */
  const languageRef = useRef(language);
  const onFeaturePressRef = useRef(onFeaturePress);

  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  useEffect(() => {
    translateRef.current = translateKey;
  }, [translateKey]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    onFeaturePressRef.current = onFeaturePress;
  }, [onFeaturePress]);

  /**
   * What to make the basemap draw, from the caller's selection when it has one and
   * from the payload on the source when it does not.
   *
   * The fallback is the native renderer's, for the same reason: a caller that mounts
   * the renderer directly with only `source.layers` must still get the groups the
   * payload named instead of a map that quietly draws all of them.
   */
  const effectiveSelection: readonly MapLayerSelection[] =
    layerSelection ??
    (source.layers?.length
      ? resolveLayerSelection(source.layers, MAPLIBRE_LAYER_CAPABILITIES)
      : NO_LAYER_SELECTION);
  const selectionKey = layerSelectionSignature(effectiveSelection);

  // Declared before the overlay effect so the toggle reads the fresh value.
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  /** Draws the current documents. Safe to call on every content or locale change. */
  const applyOverlays = useCallback((map: MapHandle) => {
    // MapLibre cannot call the translation layer, so keys become text here. A
    // document that carries its own text is read in the active language.
    const resolved: MapDocument[] = overlaysRef.current.map((overlay) =>
      withResolvedLabels(overlay, translateRef.current, languageRef.current),
    );

    try {
      applyMapDocuments(map, resolved, {
        includeLabels: showLabelsRef.current && glyphsAvailableRef.current,
      });
    } catch (err) {
      logger.error('ExperienceMap failed to apply reference documents:', err);
    }
  }, []);

  const openReference = useCallback((feature: RenderedFeature) => {
    const handler = onFeaturePressRef.current;
    if (!handler) return;

    const reference = toPressReference(feature.layer.id, feature.properties);
    if (reference) handler(reference);
  }, []);

  const { mapRef, ready, mapErrorCode, setMapErrorCode } = useWebMapInstance({
    containerRef,
    source,
    archive,
    noRegion,
    center,
    zoom,
    bounds,
    attempt: mapAttempt,
    glyphsAvailableRef,
    applyOverlays,
    openReference,
  });

  /**
   * A tapped destination moves the camera, and never rebuilds the map: `center` above
   * is an input of the map's creation, so a flight is the only honest way to travel.
   * The landing is reported back through the hook, which is the only place that
   * knows a flight actually started — a map that is not ready yet travels nowhere
   * and so has nothing to report.
   */
  useMapFocusFlight(mapRef, ready, focus, FOCUS_DURATION_MS, FOCUS_MIN_ZOOM, onFocusSettled);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    applyOverlays(map);
    // `language` is an input even though `applyOverlays` reads it through a ref: without
    // it here, switching the app language leaves every reference in the old one, because
    // the callback is stable and nothing else in the deps changes.
  }, [overlays, ready, showLabels, applyOverlays, language, mapRef]);

  /**
   * Applies the selection once the map is drawn, and again whenever it changes.
   *
   * This is the only place the decision reaches the map, so the first application and
   * a walker's toggle take the same path. The map is never rebuilt and its style is
   * never replaced: the effect only calls `setLayoutProperty`, so flipping a row
   * repaints instead of re-downloading a tile.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    applyLayerSelection(map, effectiveSelection);
    // The selection is an input by content (`selectionKey`), not by array identity: the
    // switch rebuilds the array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectionKey, applyLayerSelection]);

  /**
   * The failure this renderer would report, if any.
   *
   * A point outside every region draws no basemap on purpose, so neither an archive it
   * never needed nor a style it never draws is a failure there.
   */
  const failure: MapLoadErrorCode | undefined =
    mapErrorCode ??
    (!noRegion && archive.status === 'error'
      ? (archive.error ?? 'archiveDownloadFailed')
      : undefined);

  /** Restarts the wait that failed, and only that one. */
  const retry = useCallback(() => {
    if (!failure) return;
    switch (stageOfFailure(failure)) {
      case 'archive':
        setArchiveAttempt((previous) => previous + 1);
        break;
      case 'style':
        setStyleAttempt((previous) => previous + 1);
        break;
      case 'map':
        // Nothing to restart but the map itself: the failure is withdrawn and the build
        // below runs again.
        setMapErrorCode(null);
        setMapAttempt((previous) => previous + 1);
        break;
    }
  }, [failure, setMapErrorCode]);

  if (failure) {
    return <MapErrorView code={failure} onRetry={retry} testID={testID} className={className} />;
  }

  return (
    <TwView testID={testID} className={`${className} relative overflow-hidden`}>
      {!noRegion && archive.status === 'loading' && <LoadingView message={t('map.loadingMap')} />}
      {/* The surface the walker taps: it carries the name a screen reader announces and
          the hook a test reaches the map through, exactly as the native map does. */}
      <div
        ref={containerRef}
        className="h-full w-full z-0"
        aria-label={t('map.mapLabel')}
        data-testid={`${testID}-map`}
      />
      {/* The same one honest line the native renderer draws over its reference plane. */}
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
