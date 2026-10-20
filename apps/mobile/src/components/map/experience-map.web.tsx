import 'maplibre-gl/dist/maplibre-gl.css';

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyMapDocuments,
  toLngLatBounds,
  withResolvedLabels,
  type MapDocument,
} from '@sonora/shared';

import LoadingView from '@/components/loading-view';
import { ThemedText } from '@/components/themed-text';
import { ensureLocalProtocol, useMapSource } from '@/hooks/use-map-source';

// MapLibre runs in a Web Worker that the metro web build does not emit, so the app
// gets a request for a chunk that is not deployed and the map dies with "Worker
// failed to load". `scripts/copy-maplibre-worker.mjs` publishes that worker into
// `public/` at build time and this points MapLibre at it. It runs once per page load.
maplibregl.setWorkerUrl('/maplibre-gl-worker.js');
import { useAppTranslation } from '@/hooks/use-translation';
import { TwView } from '@/tw';
import { logger } from '@/utils/logger';

import {
  documentKeyOfLayer,
  type ExperienceMapProps,
  type MapReferencePress,
} from './map-view.types';

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
  fitBounds(bounds: [[number, number], [number, number]], options?: unknown): void;
  queryRenderedFeatures(point: unknown): RenderedFeature[];
}

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
  onFeaturePress,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: ExperienceMapProps) {
  const { t } = useAppTranslation();
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
  const onFeaturePressRef = useRef(onFeaturePress);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [centerLng, centerLat] = center;
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
    onFeaturePressRef.current = onFeaturePress;
  }, [onFeaturePress]);

  // Declared before the overlay effect so the toggle reads the fresh value.
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  /** Draws the current documents. Safe to call on every content or locale change. */
  const applyOverlays = useCallback((map: MapHandle) => {
    // MapLibre cannot call the translation layer, so keys become text here.
    const resolved: MapDocument[] = overlaysRef.current.map((overlay) =>
      withResolvedLabels(overlay, (key, options) => translateRef.current(key as never, options)),
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
        if (archive.status !== 'ready' || !archive.sourceUrl) return;

        ensureLocalProtocol(maplibregl);

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
        const style: StyleSpecification = {
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
  }, [overlays, ready, showLabels, applyOverlays]);

  if (error || archive.status === 'error') {
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
      {archive.status === 'loading' && <LoadingView message={t('map.loadingMap')} />}
      <div ref={containerRef} className="h-full w-full z-0" />
    </TwView>
  );
}
