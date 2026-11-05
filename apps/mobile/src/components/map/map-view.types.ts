import type { ReactNode } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import type {
  GeoBounds,
  MapDocument,
  MapLayerGroupConfig,
  MapLayerSelection,
} from '@sonora/shared';

export { resolveMapRenderer, MAP_RENDERER_ENV, type MapRenderer } from './resolve-renderer';

/** Where the base map tiles come from. */
export interface MapSourceConfig {
  /** PMTiles archive: `pmtiles://https://…` online, `pmtiles://file://…` offline. */
  archiveUrl: string;
  /**
   * The region `archiveUrl` belongs to, or `null` when the experience's point
   * falls in no published region.
   *
   * It rides with the archive because both are the same decision: the map draws
   * this archive, so it is this region, and the download layer keys the file it
   * stores as `<region>-<version>.pmtiles`. Absent only for a source a caller
   * assembled without resolving one (the Leaflet path never reads either field).
   */
  regionKey?: string | null;
  /**
   * The version of the archive `archiveUrl` points at (`v7`), as `archiveIdentity()`
   * reads it — or `null` when there is no archive, or its url is one this app cannot
   * key by version.
   *
   * It rides with the source for the same reason `regionKey` does: the sheet that names
   * what the map is drawing has to name the artifact the renderer actually read, and the
   * archive — not the style document — is what decides the tiles. `null` is the resolved
   * answer and never a stand-in: a version nobody parsed (`v0`) would read as a stale map
   * that the device never had.
   */
  archiveVersion?: string | null;
  /**
   * The bytes the payload advertises for that archive, or absent when it priced
   * nothing.
   *
   * The same number the download layer compares against the file on disk, so a sheet that
   * prints it is naming the archive the device was promised rather than measuring one.
   * Absent and zero both mean the payload published no price, not a zero-byte archive.
   */
  archiveBytes?: number;
  /** MapLibre style URL served from R2. */
  styleUrl?: string;
  /** Inline style, used when no URL is configured yet. */
  style?: StyleSpecification;
  /**
   * The basemap layer groups `/config` asks for, in payload order.
   *
   * It rides with the source for the same reason `regionKey` does: the map
   * components take the source as their only input, and this is a decision about
   * what the map draws. Absent means the payload named no group, and every group
   * then draws as the style authored it.
   */
  layers?: readonly MapLayerGroupConfig[];
  /**
   * Whether the payload offers the selector at all (`map.layers.showControl`).
   *
   * Separate from `layers` on purpose: a payload may switch the control on while
   * naming no group, and resolution then falls back to every group's built-in
   * default. It rides with the source for the same reason the group list does.
   */
  showLayersControl?: boolean;
  attribution?: string;
}

/** What a tap on a reference hands to the caller. */
export interface MapReferencePress {
  /** Document key the reference belongs to. */
  documentKey: string;
  /**
   * The experience this reference draws, when it draws one.
   *
   * The world's points share one document, so the key cannot name the experience a
   * tap landed on; this is what the tap reports instead, and it is the value the
   * preview resolves to the experience in the payload.
   */
  experienceSlug?: string;
  /** The label already resolved to the active language, from the document or a key. */
  labelText?: string;
  /** The description already resolved, when the reference has one. */
  descriptionText?: string;
  labelKey?: string;
  descriptionKey?: string;
  imageUrl?: string;
  linkUrl?: string;
}

/** How long the camera takes to reach a point the caller asked it to focus. */
export const FOCUS_DURATION_MS = 700;

/**
 * How long a caller waits for the camera's landing before it reveals anyway.
 *
 * The reveal belongs to the camera, never to a clock, but a renderer that never
 * reports would swallow the tap: this is the bound that turns that silence into a
 * card. Derived from the flight so the two cannot disagree, and three times it so
 * it can never race a flight the walker is still watching.
 */
export const FOCUS_SETTLE_FALLBACK_MS = FOCUS_DURATION_MS * 3;

/** The closest the focus flight goes: a point has to land as a place, not as a pixel. */
export const FOCUS_MIN_ZOOM = 15;

export interface ExperienceMapProps {
  source: MapSourceConfig;
  /** Reference documents, already delivered by the experiences payload. */
  overlays: MapDocument[];
  /** Camera fit when the map opens. Falls back to `center` + `zoom`. */
  bounds?: GeoBounds | null;
  center?: [number, number];
  zoom?: number;
  /** Where the walker is, when the app knows it. */
  userCoordinates?: { latitude: number; longitude: number };
  /**
   * The itinerary both implementations need: the new map derives its route
   * document from it, and the current Leaflet map draws it as a path plus
   * numbered markers.
   */
  waypoints?: { latitude: number; longitude: number }[];
  /** Draw the reference label layer. Defaults to true. */
  showLabels?: boolean;
  /**
   * Draw the references with their own weight, above the basemap's names.
   *
   * Passed in rather than decided by the renderer: the world hub is the one screen that
   * asks for it, because it is the one frame where an openable experience and the barrio
   * it sits in are drawn together. Absent draws today's markers exactly, which is what
   * every other map wants.
   */
  boldReferences?: boolean;
  /**
   * Which basemap groups draw, as the view that owns the decision resolved them.
   *
   * The renderer applies this and resolves nothing itself: the switch seeds it from
   * the payload and lets the walker toggle it, so one place decides and the renderer
   * only draws. Absent means no group is declared and the style draws exactly what
   * it authored.
   */
  layerSelection?: readonly MapLayerSelection[];
  /**
   * A place the caller asked the camera to move to.
   *
   * Deliberately not `center`: on both renderers `center` is an input of the map's
   * creation, so changing it rebuilds the map — a new style, new tiles, a visible
   * flash — while this only asks the camera to travel. Absent or null means nothing
   * moved.
   */
  focus?: { latitude: number; longitude: number } | null;
  /**
   * Reports that a flight the caller asked for finished moving the camera, so the
   * caller can sequence UI on the camera instead of on a clock.
   *
   * Never called for a pan the walker performs, and never twice for one flight: a
   * caller that reveals something on it is answering the move it requested, not
   * every move the map makes.
   */
  onFocusSettled?: () => void;
  onFeaturePress?: (reference: MapReferencePress) => void;
  /**
   * Drawn directly above the map, and only while the map can draw.
   *
   * The caller's controls live here instead of next to the map so a control over an
   * empty card is impossible to write: it appears with the first drawn pixel, never
   * before it — which is what the chips of the world map needed.
   */
  toolbar?: ReactNode;
  /**
   * The caller's own surface for the wait, substituted for the renderer's stage line.
   *
   * Handed the wait itself, so one card can name a transfer and its progress while the
   * renderer keeps owning the diagnosis. Absent means the renderer draws its own
   * per-stage line, which is what the detail screens want.
   */
  renderPending?: (wait: MapWaitState) => ReactNode;
  /**
   * Drawn inside the map's own card, and only while the map can draw.
   *
   * For a line or a control that belongs to the drawn map itself — the world's bare-card
   * sentence — so it inherits the card's clipping and can never appear over a wait.
   */
  overlay?: ReactNode;
  testID?: string;
  className?: string;
}

/** Suffixes of every layer a reference document owns. */
export const REFERENCE_LAYER_SUFFIXES = [':fill', ':line', ':circle', ':label'] as const;

/** Reads the document key back out of a rendered layer id (`refs:<key>:<kind>`). */
export function documentKeyOfLayer(layerId: string): string | null {
  if (!layerId.startsWith('refs:')) return null;
  const separator = layerId.lastIndexOf(':');
  return separator > 5 ? layerId.slice(5, separator) : null;
}

/**
 * Every stable failure code a map can report, from either of its waits or from the
 * renderer itself. Shared by both renderers, so a failure reads the same on both
 * platforms and no request-layer prose ever reaches the screen.
 */
export type MapLoadErrorCode =
  'archiveMissing' | 'archiveDownloadFailed' | 'styleRequestFailed' | 'styleInvalid' | 'mapFailed';

/** Which wait a failure belongs to, so a retry restarts that one and not the others. */
export type MapLoadStage = 'archive' | 'style' | 'map';

/**
 * What a renderer is still waiting for, or `null` when it can draw.
 *
 * Reported so a view can show one wait of its own for the whole card while the stage
 * a wait belongs to stays available to whoever has to diagnose a screenshot.
 */
export interface MapWaitState {
  /** Which wait is pending, in the same vocabulary failures use. */
  stage: MapLoadStage;
  /**
   * True only while a first-time archive is really being transferred, never while the
   * device is being asked whether it already has one: one is a long wait worth naming,
   * the other is a check that ends inside a frame.
   */
  downloading: boolean;
  /** Fraction of the transfer already written, `null` while it runs with no length. */
  progress: number | null;
}

export function stageOfFailure(code: MapLoadErrorCode): MapLoadStage {
  switch (code) {
    case 'archiveMissing':
    case 'archiveDownloadFailed':
      return 'archive';
    case 'mapFailed':
      return 'map';
    default:
      return 'style';
  }
}
