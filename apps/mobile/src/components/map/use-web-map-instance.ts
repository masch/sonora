import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import { toLngLatBounds, type GeoBounds } from '@sonora/shared';

import { ensureLocalProtocol, type MapSourceState } from '@/hooks/use-map-source';
import { logger } from '@/utils/logger';

import { documentKeyOfLayer, type MapLoadErrorCode, type MapSourceConfig } from './map-view.types';
import type { FocusFlightOptions } from './use-map-focus-flight';

// MapLibre runs in a Web Worker that the metro web build does not emit, so the app
// gets a request for a chunk that is not deployed and the map dies with "Worker
// failed to load". `scripts/copy-maplibre-worker.mjs` publishes that worker into
// `public/` at build time and this points MapLibre at it. It runs once per page load.
maplibregl.setWorkerUrl('/maplibre-gl-worker.js');

export interface RenderedFeature {
  layer: { id: string };
  properties: Record<string, unknown>;
}

/** The slice of the MapLibre map this component drives. */
export interface MapHandle {
  on(event: string, handler: (payload: never) => void): void;
  /**
   * One report for the next camera move to end, then gone.
   *
   * A flight is one move, and `moveend` fires for every move the walker makes too:
   * the listener has to be spent by the landing it was registered for.
   */
  once(event: string, handler: () => void): void;
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
  flyTo(options: FocusFlightOptions): void;
  getZoom(): number;
  queryRenderedFeatures(point: unknown): RenderedFeature[];
}

export interface WebMapInstanceOptions {
  /** The node MapLibre draws into: the render tree still renders and names it. */
  containerRef: RefObject<HTMLDivElement | null>;
  /**
   * What the style is built from: the style the caller brought, the url the archive's
   * own style is downloaded from, and the attribution that travels with the tiles.
   */
  source: Pick<MapSourceConfig, 'style' | 'styleUrl' | 'attribution'>;
  /** The whole download the map's style points at, once it is in memory. */
  archive: Pick<MapSourceState, 'status' | 'sourceUrl' | 'style'>;
  /**
   * The experience belongs to no published region: there is no archive to draw, and
   * that is a fact about the place, not a failure to report.
   */
  noRegion: boolean;
  /** The opening frame, when the caller gave no bounds. */
  center: [number, number];
  zoom: number;
  /** Camera fit when the map opens. Falls back to `center` + `zoom`. */
  bounds?: GeoBounds | null;
  /** The map's own build attempt: a failure there is not a wait, so it has its own counter. */
  attempt: number;
  /**
   * Labels need a glyphs source; a style without one must not get a label layer.
   *
   * Written here, where the style is built, and read by the overlay application.
   */
  glyphsAvailableRef: RefObject<boolean>;
  /** Draws the current documents; the load handler calls it once the map is drawn. */
  applyOverlays: (map: MapHandle) => void;
  /** Reports the reference a tap landed on, so the map only says what was tapped. */
  openReference: (feature: RenderedFeature) => void;
}

export interface WebMapInstance {
  /** The map this hook created, and removes on unmount. */
  mapRef: RefObject<MapHandle | null>;
  /** The map reported its load: the overlays and the selection wait on this. */
  ready: boolean;
  /**
   * The map's own failure, as the code the screen translates.
   *
   * A map that could not be created and a map that reported an error both end here: what
   * a renderer or a request said is logged and never drawn.
   */
  mapErrorCode: MapLoadErrorCode | null;
  /** The failure is a state of this hook, and a retry has to withdraw it from here. */
  setMapErrorCode: Dispatch<SetStateAction<MapLoadErrorCode | null>>;
}

/**
 * The map instance: created once per source and camera, and removed on unmount.
 *
 * Everything that can change on every render — callbacks, translation, documents — is
 * read through refs, so a re-render never tears the map down: a rebuilt map would
 * re-fetch its style and tiles and fire `load` again, which loops.
 *
 * The style is assembled here because it is an input of the map's creation: the
 * archive in memory is what the vector source points at, and a caller's style is only
 * the frame that source is written into. Nothing that changes without a new map — the
 * documents, the layer selection, the camera's own flights — is done here.
 */
export function useWebMapInstance({
  containerRef,
  source,
  archive,
  noRegion,
  center,
  zoom,
  bounds,
  attempt,
  glyphsAvailableRef,
  applyOverlays,
  openReference,
}: WebMapInstanceOptions): WebMapInstance {
  const mapRef = useRef<MapHandle | null>(null);
  const cancelledRef = useRef(false);

  /**
   * The build whose map reported its load, or `null` before the first one does.
   *
   * The build and not a boolean, because readiness is a fact about one instance: a map
   * that is being replaced has not reported anything, and the replacement has to pass
   * through "not loaded yet" for the effects below to run against it.
   */
  const [loadedAttempt, setLoadedAttempt] = useState<number | null>(null);
  /** The map's own failure, as the code the screen translates. */
  const [mapErrorCode, setMapErrorCode] = useState<MapLoadErrorCode | null>(null);

  /**
   * The instance in `mapRef` is drawn: it loaded, and it is the build this render is for.
   *
   * Derived during render rather than reset inside the effect, which keeps the
   * false→true transition the ready-gated effects need. Left `true` across a retry, the
   * pending focus flight and the layer selection never ran for the new instance, so a
   * rebuilt map never travelled to the selected point and ignored the active layers.
   */
  const ready = loadedAttempt !== null && loadedAttempt === attempt;

  const [centerLng, centerLat] = center;
  const boundsWest = bounds?.west;
  const boundsSouth = bounds?.south;
  const boundsEast = bounds?.east;
  const boundsNorth = bounds?.north;

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
          setMapErrorCode('mapFailed');
        }) as never);

        map.on('load', (() => {
          if (cancelledRef.current) return;
          // The build this instance drew, not a bare flag: the next build starts unloaded.
          setLoadedAttempt(attempt);
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
        if (!cancelledRef.current) setMapErrorCode('mapFailed');
      }
    }

    init();

    return () => {
      cancelledRef.current = true;
      mapRef.current?.remove();
      mapRef.current = null;
      // `ready` is not touched here: it is read from the build the map loaded for, so the
      // replacement is reported as not ready until it says otherwise.
    };
    // The two refs are stable, and the callback the renderer hands in is built with no
    // dependencies of its own: `source` and `archive` are read by the fields listed, so
    // a caller that rebuilds its objects on every render does not rebuild the map.
  }, [
    attempt,
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
    containerRef,
    glyphsAvailableRef,
    applyOverlays,
    openReference,
  ]);

  return { mapRef, ready, mapErrorCode, setMapErrorCode };
}
