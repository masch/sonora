import 'maplibre-gl/dist/maplibre-gl.css';

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MAPLIBRE_LAYER_CAPABILITIES,
  applyMapDocuments,
  layerSelectionSignature,
  resolveLayerSelection,
  toLngLatBounds,
  withResolvedLabels,
  type MapDocument,
  type MapLayerSelection,
} from '@sonora/shared';

import LoadingView from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ensureLocalProtocol, useMapSource } from '@/hooks/use-map-source';
import { applyLayerSelection } from './web-layer-visibility';

import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';
import { logger } from '@/utils/logger';

import {
  documentKeyOfLayer,
  FOCUS_DURATION_MS,
  FOCUS_MIN_ZOOM,
  type ExperienceMapProps,
  type MapReferencePress,
} from './map-view.types';
import { useMapFocusFlight } from './use-map-focus-flight';

// MapLibre runs in a Web Worker that the metro web build does not emit, so the app
// gets a request for a chunk that is not deployed and the map dies with "Worker
// failed to load". `scripts/copy-maplibre-worker.mjs` publishes that worker into
// `public/` at build time and this points MapLibre at it. It runs once per page load.
maplibregl.setWorkerUrl('/maplibre-gl-worker.js');

interface RenderedFeature {
  layer: { id: string };
  properties: Record<string, unknown>;
}

/** The slice of the MapLibre map this component drives. */
interface MapHandle {
  on(event: string, handler: (payload: never) => void): void;
  remove(): void;
  getStyle(): { layers?: { id: string }[]; sources?: Record<string, unknown> };
  getSource(id: string): { setData?: (data: unknown) => void } | undefined;
  addSource(id: string, value: unknown): void;
  removeSource(id: string): void;
  addLayer(layer: unknown): void;
  removeLayer(id: string): void;
  /**
   * Writes one layout property onto one layer that is already drawn.
   *
   * This is the whole of how the selector reaches the map: the alternative is a new
   * style, which re-fetches every tile the archive is already serving.
   */
  setLayoutProperty(layerId: string, name: string, value: string): void;
  fitBounds(bounds: [[number, number], [number, number]], options?: unknown): void;
  /** Travels to a place, animating: the map is not rebuilt for a destination. */
  flyTo(center: [number, number], options?: unknown): void;
  getZoom(): number;
  queryRenderedFeatures(point: unknown): RenderedFeature[];
}

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
 * The map instance is created once per source and camera. Everything that can
 * change on every render — callbacks, translation, documents — is read through
 * refs, so a re-render never tears the map down: a rebuilt map would re-fetch
 * its style and tiles and fire `load` again, which loops.
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
  onFeaturePress,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: ExperienceMapProps) {
  const { t, language } = useAppTranslation();
  /**
   * The experience belongs to no published region: there is no archive to draw, and
   * that is a fact about the place, not a failure to report. `null` is the resolved
   * answer; an absent key means the caller never resolved one.
   */
  const noRegion = source.regionKey === null;
  // The archive is downloaded whole and its tiles are read from memory: the route
  // that serves the bucket supports no byte ranges.
  const archive = useMapSource(source.archiveUrl, source.styleUrl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const cancelledRef = useRef(false);

  const overlaysRef = useRef(overlays);
  /** Labels need a glyphs source; a style without one must not get a label layer. */
  const glyphsAvailableRef = useRef(false);
  /** Read inside `applyOverlays`, which is stable, so toggling never rebuilds the map. */
  const showLabelsRef = useRef(showLabels);
  const translateRef = useRef(t);
  /** Read inside `applyOverlays`: a self-contained reference draws its own text. */
  const languageRef = useRef(language);
  const onFeaturePressRef = useRef(onFeaturePress);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [centerLng, centerLat] = center;

  /**
   * A tapped destination moves the camera, and never rebuilds the map: `center` above
   * is an input of the map's creation, so a flight is the only honest way to travel.
   */
  useMapFocusFlight(mapRef, ready, focus, FOCUS_DURATION_MS, FOCUS_MIN_ZOOM);
  const boundsWest = bounds?.west;
  const boundsSouth = bounds?.south;
  const boundsEast = bounds?.east;
  const boundsNorth = bounds?.north;

  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  useEffect(() => {
    translateRef.current = t;
  }, [t]);

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
      withResolvedLabels(
        overlay,
        (key, options) => translateRef.current(key as never, options),
        languageRef.current,
      ),
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

  useEffect(() => {
    cancelledRef.current = false;

    function init() {
      try {
        if (cancelledRef.current || !containerRef.current) return;
        if (!noRegion && (archive.status !== 'ready' || !archive.sourceUrl)) return;

        ensureLocalProtocol(maplibregl);

        // With no region the reference plane is the whole map: no basemap is drawn at
        // all instead of one whose tiles nobody downloaded.
        let style: StyleSpecification;
        if (noRegion) {
          style = { version: 8, sources: {}, layers: [] };
        } else {
          const inlineStyle: StyleSpecification = {
            version: 8,
            sources: {
              basemap: {
                type: 'vector',
                url: archive.sourceUrl,
                ...(source.attribution ? { attribution: source.attribution } : {}),
              },
            },
            layers: [],
          };

          const baseStyle = source.style ?? archive.style ?? inlineStyle;

          // The archive is already in memory: the style points at the local protocol.
          style = {
            ...baseStyle,
            sources: {
              ...baseStyle.sources,
              basemap: {
                ...(baseStyle.sources.basemap as VectorSourceSpecification),
                type: 'vector',
                url: archive.sourceUrl,
              },
            },
          };
        }
        glyphsAvailableRef.current = Boolean(style.glyphs);

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [centerLng, centerLat],
          zoom,
          attributionControl: { compact: true },
        }) as unknown as MapHandle;

        mapRef.current = map;

        map.on('error', ((event: { error?: Error }) => {
          logger.error('ExperienceMap error:', event.error);
          setError(event.error?.message ?? 'map error');
        }) as never);

        map.on('load', (() => {
          if (cancelledRef.current) return;
          setReady(true);
          applyOverlays(map);
          if (boundsWest !== undefined) {
            map.fitBounds(
              toLngLatBounds({
                west: boundsWest,
                south: boundsSouth ?? boundsWest,
                east: boundsEast ?? boundsWest,
                north: boundsNorth ?? boundsWest,
              }),
              { padding: 24 },
            );
          }
        }) as never);

        map.on('click', ((event: { point: unknown }) => {
          const hit = map
            .queryRenderedFeatures(event.point)
            .find((feature) => documentKeyOfLayer(feature.layer.id));
          if (hit) openReference(hit);
        }) as never);
      } catch (err) {
        logger.error('ExperienceMap init failed:', err);
        if (!cancelledRef.current) setError(err instanceof Error ? err.message : 'map init failed');
      }
    }

    init();

    return () => {
      cancelledRef.current = true;
      mapRef.current?.remove();
      mapRef.current = null;
      // `ready` is not reset: the new map reports its own load, and the overlay
      // effect already ignores the case where no map exists.
    };
  }, [
    archive.status,
    archive.sourceUrl,
    archive.style,
    noRegion,
    source.style,
    source.styleUrl,
    source.attribution,
    centerLng,
    centerLat,
    zoom,
    boundsWest,
    boundsSouth,
    boundsEast,
    boundsNorth,
    applyOverlays,
    openReference,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    applyOverlays(map);
    // `language` is an input even though `applyOverlays` reads it through a ref: without
    // it here, switching the app language leaves every reference in the old one, because
    // the callback is stable and nothing else in the deps changes.
  }, [overlays, ready, showLabels, applyOverlays, language]);

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

  if (error || (!noRegion && archive.status === 'error')) {
    return (
      <TwView
        testID={`${testID}-error`}
        className={`${className} items-center justify-center gap-2 bg-backgroundElement px-4`}
      >
        <ThemedText>{t('map.offlineTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {archive.error ?? t('map.offlineDescription')}
        </ThemedText>
      </TwView>
    );
  }

  return (
    <TwView testID={testID} className={`${className} relative overflow-hidden`}>
      {!noRegion && archive.status === 'loading' && <LoadingView message={t('map.loadingMap')} />}
      <div ref={containerRef} className="h-full w-full z-0" />
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
