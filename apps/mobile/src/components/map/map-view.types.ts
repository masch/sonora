import type { StyleSpecification } from 'maplibre-gl';
import type { GeoBounds, MapDocument, MapLayerGroupConfig } from '@sonora/shared';

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
  attribution?: string;
}

/** What a tap on a reference hands to the caller. */
export interface MapReferencePress {
  /** Document key the reference belongs to. */
  documentKey: string;
  label?: string;
  labelKey?: string;
  descriptionKey?: string;
  imageUrl?: string;
  linkUrl?: string;
}

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
  onFeaturePress?: (reference: MapReferencePress) => void;
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
