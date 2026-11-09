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
import { attributionWithVersion } from '@/utils/map-attribution';
import { logger } from '@/utils/logger';

import { documentKeyOfLayer, type MapLoadErrorCode, type MapSourceConfig } from './map-view.types';
import { reportMapFailure, type MapFailureDetail } from './report-map-failure';
import type { FocusFlightOptions } from './use-map-focus-flight';

// MapLibre runs in a Web Worker that the metro web build does not emit, so the app
// gets a request for a chunk that is not deployed and the map dies with "Worker
// failed to load". `scripts/copy-maplibre-worker.mjs` publishes that worker into
// `public/` at build time and this points MapLibre at it. It runs once per page load.
maplibregl.setWorkerUrl('/maplibre-gl-worker.js');

/**
 * How long a web map may go without reporting `load` or `error` before it is failed.
 *
 * The native renderer has its own deadline for its style wait; on the web there was
 * none, so a worker or a style that never answers throws nothing, reports nothing, and
 * leaves the card spinning forever — the one failure no log could reach. The deadline
 * is generous on purpose: it only has to catch a wait that is never going to end.
 */
export const WEB_LOAD_TIMEOUT_MS = 20_000;

/**
 * The failure MapLibre reports, in the shape the library actually produces.
 *
 * A request that failed arrives as an `AJAXError`: the status the server answered with
 * and the url that was requested live **on the error itself**, never on the event.
 */
interface MapLibreFailure extends Error {
  /** The answer a server gave, on a request that failed. */
  status?: number;
  /** The request that failed, query string and all. */
  url?: string;
}

/** The parts of MapLibre's `error` event that say *what* failed, not only *that* it did. */
interface MapLibreErrorEvent {
  error?: MapLibreFailure;
  /** The style source the failure belongs to, when the library knows one. */
  sourceId?: string;
  /**
   * The tile being loaded, which is the library's internal `Tile` instance.
   *
   * It carries no url at all, so a url read from here is a read that never finds
   * anything: the tile's request is only named on the error above.
   */
  tile?: unknown;
}

/**
 * The console record of an `error` event.
 *
 * The library reports a source on the event and the request on the error, and the
 * renderer used to keep neither: a worker served as an SPA fallback, a basemap whose
 * TileJSON never arrived and a tile that 404s all produced the same line.
 */
function errorFields(event: MapLibreErrorEvent): { sourceId: string | null; url: string | null } {
  return { sourceId: event.sourceId ?? null, url: event.error?.url ?? null };
}

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
   *
   * `archiveVersion` is here because the credit is composed here: the notice belongs to
   * the style document, the version belongs to the archive, and the style this hook
   * hands MapLibre is the only place the web renderer holds both at once — the document
   * is either in memory or about to be, and nothing that reaches the map may fetch the
   * style again to say what it already says.
   */
  source: Pick<MapSourceConfig, 'style' | 'styleUrl' | 'attribution' | 'archiveVersion'>;
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
   * Only a failure to draw ends here: a map that could not be created, and one that
   * reported an error before ever reporting `load`. MapLibre also emits `error` for
   * recoverable failures — a sprite that 404s, one layer whose source never arrived —
   * and those arrive on a map that is drawing, so they are logged and the map stays.
   */
  mapErrorCode: MapLoadErrorCode | null;
  /** The failure is a state of this hook, and a retry has to withdraw it from here. */
  setMapErrorCode: Dispatch<SetStateAction<MapLoadErrorCode | null>>;
}

/**
 * Whether the node a map draws into is still rendered.
 *
 * A failure surface replaces the map, which unmounts the container and leaves the
 * instance drawing into a node nobody reads. A late `load` there must not withdraw the
 * failure that sent the walker to the retry: clearing the code would re-render an empty
 * container over a map bound to the old node, and the retry is what rebuilds the map.
 *
 * Tolerant on purpose: the container is a real element in a browser, and a node that
 * cannot answer is not one to keep drawing over.
 */
function isInDocument(node: unknown): boolean {
  return Boolean((node as { isConnected?: boolean } | null)?.isConnected);
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
   * Derived during render and cleared by the build effect, so one instance's load is never
   * read as another's: the replacement starts at "not loaded yet" and the effects below see
   * the false→true transition they need. Left `true` across a rebuild that is not a retry,
   * the pending focus flight and the layer selection never ran for the new instance, so a
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
    /** The deadline this build owes: cleared by its own load, its failure, or its removal. */
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

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
          // The credit is the document's own, extended with the version of the archive
          // this device is drawing, so the walker can read both from one notice. The
          // suffix is written here rather than into the cached document: the document is
          // the publisher's and the version is this device's.
          const basemapSource = baseStyle.sources.basemap as VectorSourceSpecification | undefined;
          const attribution = attributionWithVersion(
            basemapSource?.attribution,
            source.archiveVersion,
          );
          style = {
            ...baseStyle,
            sources: {
              ...baseStyle.sources,
              basemap: {
                ...basemapSource,
                type: 'vector',
                url: archive.sourceUrl,
                ...(attribution === undefined ? {} : { attribution }),
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

        foldAttribution(map, containerRef.current);

        // Whether this instance ever drew. An error before it did is a failure to draw
        // and the screen has to say so; an error after it is one of the recoverable
        // failures MapLibre reports on a map that is working — a missing sprite, a layer
        // whose source never arrived — and it is not the event's business to be believed
        // about that: the event carries no fatal flag, and `sourceId`/`tile` appear on
        // both kinds. What this code can own is the order: drawn, or never drawn.
        let drewOnce = false;
        /**
         * This instance's failure is already reported.
         *
         * MapLibre emits `error` once per failing tile, and a report per event would
         * spend the eight non-fatal slots Crashlytics keeps per session on one broken
         * basemap. The reporter deduplicates what it can, and this flag is the part it
         * cannot see: two tiles of one source are one failure.
         */
        let reported = false;

        /**
         * This build's failure: shown every time, reported once per cause.
         *
         * The code is set on every failure because the screen has to say that the map cannot
         * draw: a late `load` withdraws a deadline, and the context loss that follows is
         * still a map drawing nothing. Only the report is held back per stage — MapLibre
         * emits `error` once per failing tile, so the draw stage reports once per build,
         * while a lost context is its own episode and names itself.
         *
         * Also the reason the deadline below cannot contradict an earlier answer: an error
         * that arrives before the map ever drew has already failed this build, and a
         * "timed out" report twenty seconds later would be a second, false cause on top of
         * the real one. The deadline is cleared here for that reason.
         */
        const fail = (detail: MapFailureDetail): void => {
          clearTimeout(loadTimer);
          setMapErrorCode('mapFailed');
          if (detail.stage === 'draw') {
            if (reported) return;
            reported = true;
          }
          reportMapFailure('mapFailed', detail);
        };

        // A map that never draws and never fails has to acquire a failure of its own, or
        // the wait has no end and nothing is reported at all.
        loadTimer = setTimeout(() => {
          if (cancelledRef.current || drewOnce) return;
          logger.error('ExperienceMap load timed out:', { timeoutMs: WEB_LOAD_TIMEOUT_MS });
          fail({ stage: 'timeout', message: `no load after ${WEB_LOAD_TIMEOUT_MS}ms` });
        }, WEB_LOAD_TIMEOUT_MS);

        map.on('error', ((event: MapLibreErrorEvent) => {
          logger.error('ExperienceMap error:', event.error, errorFields(event));
          if (drewOnce) return;
          // The cause is the error's own: a request that failed carries the status and
          // the url there, and a worker that never loaded carries only its sentence —
          // an event with neither source nor tile would otherwise report the bare stage.
          fail({
            stage: 'draw',
            sourceId: event.sourceId ?? null,
            httpStatus: event.error?.status ?? null,
            url: event.error?.url ?? null,
            message: event.error?.message ?? null,
          });
        }) as never);

        /**
         * The one post-load failure that is still fatal, and the signal that says so.
         *
         * A drawn map can lose the context it draws with — a GPU reset, a driver that
         * drops the tab — and after that every later frame is blank. The `error` event
         * cannot be believed about this (no fatal flag, and `sourceId`/`tile` appear on
         * recoverable failures too), but the canvas has an event for exactly this
         * state, so the screen follows the one signal that means "this map cannot draw
         * any more" instead of guessing from a message.
         */
        watchContextLoss(containerRef.current, () => {
          // Reported because this used to be the one silent failure: a reset context
          // draws nothing, fires no `error`, and left no trace anywhere.
          logger.error('ExperienceMap context lost:', { attempt });
          fail({ stage: 'contextLost' });
        });

        map.on('load', (() => {
          if (cancelledRef.current) return;
          drewOnce = true;
          clearTimeout(loadTimer);
          // The map drew, so it is not a failed map — while it still has a node to draw
          // into. `load` waits for tiles and the sprite, so a working map can pass the
          // deadline above and load afterwards: leaving the code would keep a "map failed"
          // card over a map that draws, and the walker would have no way back to it. The
          // report stays as the record the deadline made; only the screen stops saying the
          // map failed. Once the failure surface replaced the map, the container is gone
          // and this instance is attached to a detached node: the code stays, because
          // withdrawing it would re-render an empty container and the retry rebuilds.
          if (isInDocument(containerRef.current)) setMapErrorCode(null);
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
        // The map that threw cannot keep a deadline running: it would report a second,
        // false cause on top of this one.
        clearTimeout(loadTimer);
        logger.error('ExperienceMap init failed:', err);
        if (!cancelledRef.current) {
          reportMapFailure('mapFailed', {
            stage: 'draw',
            message: err instanceof Error ? err.message : String(err),
          });
          setMapErrorCode('mapFailed');
        }
      }
    }

    init();

    return () => {
      cancelledRef.current = true;
      clearTimeout(loadTimer);
      mapRef.current?.remove();
      mapRef.current = null;
      // The build that reported its load is gone with this instance, and the one that
      // replaces it has drawn nothing, so readiness starts over: clearing it here, where
      // the instance is removed, is what makes the replacement pass through "not loaded
      // yet" and the ready-gated effects run against it. A retry is unaffected: its own
      // attempt number already made the old answer stale.
      setLoadedAttempt(null);
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
    source.archiveVersion,
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

/**
 * Keeps MapLibre's compact attribution folded until the walker opens it.
 *
 * MapLibre does not open it when the control is added — it opens it when the **first
 * attribution arrives**: `_updateAttributions()` adds `compact` and `compact-show` the
 * moment a source publishes its credit, and folds the control again only on the map's
 * `drag` event. A card-sized map is never dragged, so the credit stays open over the
 * place the walker is reading and over a point's label.
 *
 * Folding it once at creation is too early — the control does not exist yet — so this
 * folds it wherever the attribution can appear (`styledata`, `sourcedata`) and stops
 * asking as soon as the walker opens it by hand. That is the same pair of steps the
 * library's own minimize performs, which is why the ⓘ keeps working.
 *
 * Tolerant on purpose: the container is a real DOM element in a browser and a bare host
 * node under test.
 */
export function foldAttribution(
  map: {
    on: (event: string, handler: () => void) => void;
  },
  container: unknown,
): void {
  let openedByWalker = false;
  /** The credit's own listener is bound once, on the first fold that finds it. */
  let listeningToWalker = false;

  /**
   * Binds the ⓘ the first time a fold can see it.
   *
   * The control does not exist when the map is built — MapLibre adds it when the first
   * attribution arrives, which is the same reason folding runs on the data events — so a
   * listener bound at creation would never attach, the walker's click would flip nothing,
   * and every later data event would fold the credit back over the map.
   */
  const listenToWalker = (): void => {
    if (listeningToWalker) return;
    const summary = queryAttribution(container)?.querySelector?.('summary');
    if (typeof summary?.addEventListener !== 'function') return;
    summary.addEventListener('click', () => {
      openedByWalker = true;
    });
    listeningToWalker = true;
  };

  const fold = (): void => {
    listenToWalker();
    if (!openedByWalker) collapseAttribution(container);
  };

  map.on('styledata', fold);
  map.on('sourcedata', fold);
  fold();
}

/** Folds the control, the way the library's own minimize does. */
export function collapseAttribution(container: unknown): void {
  queryAttribution(container)?.classList?.remove('maplibregl-compact-show');
  queryAttribution(container)?.setAttribute?.('open', '');
}

/** The compact attribution element inside a map container, or `null`. */
function queryAttribution(container: unknown): {
  classList?: { remove: (name: string) => void };
  setAttribute?: (name: string, value: string) => void;
  querySelector?: (selector: string) => {
    addEventListener?: (event: string, handler: () => void) => void;
  } | null;
} | null {
  const query = (container as { querySelector?: unknown } | null)?.querySelector;
  if (typeof query !== 'function') return null;

  return (query as (selector: string) => ReturnType<typeof queryAttribution>).call(
    container,
    '.maplibregl-ctrl-attrib.maplibregl-compact',
  );
}

/**
 * Calls `onLost` when the map's canvas loses its WebGL context.
 *
 * The DOM event exists for this one state, and it fires after the map has drawn as well
 * as before, which is the case an error event cannot distinguish. Tolerant like the rest
 * of this module: the container is a real element in a browser and a bare host node under
 * test, and a map that is already gone has nothing to watch.
 */
export function watchContextLoss(container: unknown, onLost: () => void): void {
  const canvas = (
    container as { querySelector?: (selector: string) => unknown } | null
  )?.querySelector?.('canvas') as {
    addEventListener?: (event: string, handler: () => void) => void;
  } | null;

  canvas?.addEventListener?.('webglcontextlost', onLost);
}
