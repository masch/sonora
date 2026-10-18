/** Prefix shared by every source and layer this module owns. */
export const REFERENCE_SOURCE_PREFIX = 'refs:';

const DEFAULT_COLOR = '#065f46';
const LABEL_FONT = ['Noto Sans Regular'];

export interface MapStyleLayer {
  id: string;
  type: 'fill' | 'line' | 'circle' | 'symbol';
  source: string;
  filter?: unknown[];
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  minzoom?: number;
}

export function referenceSourceId(key: string): string {
  return `${REFERENCE_SOURCE_PREFIX}${key}`;
}

/**
 * The four layers a reference document needs: areas, lines, points and labels.
 * Styling reads feature properties, so the layers do not depend on document content.
 */
export function buildReferenceStyleLayers(sourceId: string): MapStyleLayer[] {
  const color = ['coalesce', ['get', 'color'], DEFAULT_COLOR];

  return [
    {
      id: `${sourceId}:fill`,
      type: 'fill',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': color, 'fill-opacity': 0.25, 'fill-outline-color': color },
    },
    {
      id: `${sourceId}:line`,
      type: 'line',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.9 },
    },
    {
      id: `${sourceId}:circle`,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': color,
        'circle-radius': 6,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    },
    {
      id: `${sourceId}:label`,
      type: 'symbol',
      source: sourceId,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': LABEL_FONT,
        'text-size': 12,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': color,
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.4,
      },
    },
  ];
}
