import type { StyleSpecification } from 'maplibre-gl';
import type { GeoBounds, MapDocument } from '@sonora/shared';

export { resolveMapRenderer, MAP_RENDERER_ENV, type MapRenderer } from './resolve-renderer';

/** Where the base map tiles come from. */
export interface MapSourceConfig {
  /** PMTiles archive: `pmtiles://https://…` online, `pmtiles://file://…` offline. */
  archiveUrl: string;
  /** MapLibre style URL served from R2. */
  styleUrl?: string;
  /** Inline style, used when no URL is configured yet. */
  style?: StyleSpecification;
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
