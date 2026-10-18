import 'maplibre-gl/dist/maplibre-gl.css';

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyMapDocuments,
  toLngLatBounds,
  withResolvedLabels,
  type MapDocument,
} from '@sonora/shared';

import { ThemedText } from '@/components/themed-text';
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

/** The pmtiles protocol is global to the MapLibre module, not to an instance. */
let protocolRegistered = false;

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
 * The base style is served from R2 (see the style task); until it exists the map
 * draws the reference documents over an empty canvas.
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
  onFeaturePress,
  onReady,
  testID = 'experience-map',
  className = 'h-80 w-full',
}: ExperienceMapProps) {
  const { t } = useAppTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapHandle | null>(null);

  const overlaysRef = useRef(overlays);
  /** Labels need a glyphs source; a style without one must not get a label layer. */
  const glyphsAvailableRef = useRef(false);
  const translateRef = useRef(t);
  const onReadyRef = useRef(onReady);
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
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onFeaturePressRef.current = onFeaturePress;
  }, [onFeaturePress]);

  /** Draws the current documents. Safe to call on every content or locale change. */
  const applyOverlays = useCallback((map: MapHandle) => {
    // MapLibre cannot call the translation layer, so keys become text here.
    const resolved: MapDocument[] = overlaysRef.current.map((overlay) =>
      withResolvedLabels(overlay, (key) => translateRef.current(key as never)),
    );

    try {
      applyMapDocuments(map, resolved, { includeLabels: glyphsAvailableRef.current });
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
    let cancelled = false;

    function init() {
      try {
        if (cancelled || !containerRef.current) return;

        if (!protocolRegistered) {
          maplibregl.addProtocol('pmtiles', new Protocol().tile);
          protocolRegistered = true;
        }

        const inlineStyle: StyleSpecification = {
          version: 8,
          sources: {
            basemap: {
              type: 'vector',
              url: source.archiveUrl,
              ...(source.attribution ? { attribution: source.attribution } : {}),
            },
          },
          layers: [],
        };

        const style = source.style ?? inlineStyle;
        glyphsAvailableRef.current = Boolean((style as StyleSpecification).glyphs);

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
          if (cancelled) return;
          setReady(true);
          onReadyRef.current?.();
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'map init failed');
      }
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [
    source.archiveUrl,
    source.style,
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
  }, [overlays, ready, applyOverlays]);

  if (error) {
    return (
      <TwView
        testID={`${testID}-error`}
        className={`${className} items-center justify-center gap-2 bg-backgroundElement px-4`}
      >
        <ThemedText>{t('map.offlineTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('map.offlineDescription')}
        </ThemedText>
      </TwView>
    );
  }

  return (
    <TwView testID={testID} className={`${className} relative overflow-hidden`}>
      <div ref={containerRef} className="h-full w-full z-0" />
    </TwView>
  );
}
