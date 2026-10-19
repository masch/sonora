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
export interface ReferenceLayerOptions {
  /** Labels need a glyphs source in the style; omit them when there is none. */
  includeLabels?: boolean;
}

export function buildReferenceStyleLayers(
  sourceId: string,
  options: ReferenceLayerOptions = {},
): MapStyleLayer[] {
  const color = ['coalesce', ['get', 'color'], DEFAULT_COLOR];
  // A feature may declare the zoom it appears at; MapLibre cannot read a
  // per-feature minzoom on the layer, so it becomes a zoom comparison.
  const fromZoom = ['>=', ['zoom'], ['coalesce', ['get', 'minzoom'], 0]];
  const forGeometry = (kind: string) => ['all', ['==', ['geometry-type'], kind], fromZoom];

  const layers: MapStyleLayer[] = [
    {
      id: `${sourceId}:fill`,
      type: 'fill',
      source: sourceId,
      filter: forGeometry('Polygon'),
      paint: { 'fill-color': color, 'fill-opacity': 0.25, 'fill-outline-color': color },
    },
    {
      id: `${sourceId}:line`,
      type: 'line',
      source: sourceId,
      filter: forGeometry('LineString'),
      paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.9 },
    },
    {
      id: `${sourceId}:circle`,
      type: 'circle',
      source: sourceId,
      filter: forGeometry('Point'),
      paint: {
        'circle-color': color,
        'circle-radius': 6,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    },
  ];

  if (options.includeLabels !== false) {
    layers.push({
      id: `${sourceId}:label`,
      type: 'symbol',
      source: sourceId,
      filter: forGeometry('Point'),
      layout: {
        'text-field': ['get', 'label'],
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
    });
  }

  return layers;
}
