import { describe, expect, it } from 'vitest';

import {
  applyMapDocuments,
  boundsOfDocuments,
  buildReferenceStyleLayers,
  MAP_REFERENCE_LIMITS,
  mapDocumentSchema,
  parseMapDocument,
  REFERENCE_SOURCE_PREFIX,
  type MapDocument,
  type MapLike,
} from '../map';

function documentWith(key: string, features: readonly Record<string, unknown>[]): MapDocument {
  return {
    key,
    scope: 'experience',
    collection: { type: 'FeatureCollection', features: [...features] },
  } as MapDocument;
}

const point = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
  properties: { name: 'Taller' },
};

const line = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-64.74, -32.21],
      [-64.735, -32.215],
    ],
  },
  properties: { name: 'Sendero' },
};

const polygon = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-64.745, -32.2],
        [-64.74, -32.2],
        [-64.74, -32.205],
        [-64.745, -32.2],
      ],
    ],
  },
  properties: { name: 'Bosque' },
};

describe('map document schema', () => {
  it('accepts a document made of point, line and polygon references', () => {
    const parsed = mapDocumentSchema.parse(documentWith('sendero', [point, line, polygon]));

    expect(parsed.key).toBe('sendero');
    expect(parsed.collection.features).toHaveLength(3);
  });

  it('rejects a document whose reference has no name', () => {
    const broken = documentWith('sin-nombre', [{ ...point, properties: {} }]);

    expect(() => parseMapDocument(broken)).toThrow();
  });

  it('rejects geometries outside the supported subset', () => {
    const broken = documentWith('multipunto', [
      {
        type: 'Feature',
        geometry: { type: 'MultiPoint', coordinates: [[0, 0]] },
        properties: { name: 'x' },
      },
    ]);

    expect(() => parseMapDocument(broken)).toThrow();
  });

  it('rejects documents over the feature limit', () => {
    const tooMany = Array.from({ length: MAP_REFERENCE_LIMITS.maxFeatures + 1 }, () => point);

    expect(() => parseMapDocument(documentWith('enorme', tooMany))).toThrow();
  });
});

describe('map camera bounds', () => {
  it('covers every geometry in every document', () => {
    const bounds = boundsOfDocuments([
      documentWith('uno', [point]),
      documentWith('dos', [line, polygon]),
    ]);

    expect(bounds).toEqual({ west: -64.745, south: -32.215, east: -64.735, north: -32.2 });
  });

  it('returns null when there is nothing to fit', () => {
    expect(boundsOfDocuments([])).toBeNull();
    expect(boundsOfDocuments([documentWith('vacio', [])])).toBeNull();
  });
});

describe('reference style layers', () => {
  it('builds one styled layer per geometry kind plus a label layer', () => {
    const layers = buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`);

    expect(layers.map((layer) => layer.id)).toEqual([
      `${REFERENCE_SOURCE_PREFIX}sendero:fill`,
      `${REFERENCE_SOURCE_PREFIX}sendero:line`,
      `${REFERENCE_SOURCE_PREFIX}sendero:circle`,
      `${REFERENCE_SOURCE_PREFIX}sendero:label`,
    ]);
    expect(layers.map((layer) => layer.type)).toEqual(['fill', 'line', 'circle', 'symbol']);
    expect(layers[3].layout).toMatchObject({ 'text-field': ['get', 'name'] });
  });
});

describe('applyMapDocuments', () => {
  function createFakeMap() {
    const calls: string[] = [];
    const layers: { id: string; source?: string }[] = [];
    const sources: Record<string, { setData: (data: unknown) => void }> = {};

    const map: MapLike = {
      getStyle: () => ({ layers, sources }),
      addSource: (id) => {
        calls.push(`addSource:${id}`);
        sources[id] = { setData: () => calls.push(`setData:${id}`) };
      },
      removeSource: (id) => {
        calls.push(`removeSource:${id}`);
        delete sources[id];
      },
      addLayer: (layer) => {
        const added = layer as { id: string; source?: string };
        calls.push(`addLayer:${added.id}`);
        layers.push({ id: added.id, source: added.source });
      },
      removeLayer: (id) => {
        calls.push(`removeLayer:${id}`);
        const index = layers.findIndex((layer) => layer.id === id);
        if (index >= 0) layers.splice(index, 1);
      },
      getSource: (id) => sources[id],
    };

    return { map, calls, layers, sources };
  }

  it('adds the source and its layers on the first apply', () => {
    const { map, calls } = createFakeMap();

    applyMapDocuments(map, [documentWith('sendero', [point])]);

    expect(calls).toContain(`addSource:${REFERENCE_SOURCE_PREFIX}sendero`);
    expect(calls).toContain(`addLayer:${REFERENCE_SOURCE_PREFIX}sendero:circle`);
    expect(calls.filter((call) => call.startsWith('addSource:'))).toHaveLength(1);
  });

  it('pushes new data instead of adding a second source on re-apply', () => {
    const { map, calls } = createFakeMap();
    const documents = [documentWith('sendero', [point])];

    applyMapDocuments(map, documents);
    calls.length = 0;
    applyMapDocuments(map, documents);

    expect(calls).toEqual([`setData:${REFERENCE_SOURCE_PREFIX}sendero`]);
  });

  it('removes reference layers and sources that are no longer present', () => {
    const { map, calls, layers, sources } = createFakeMap();
    applyMapDocuments(map, [documentWith('sendero', [point])]);

    applyMapDocuments(map, []);

    expect(layers).toHaveLength(0);
    expect(Object.keys(sources)).toHaveLength(0);
    expect(calls).toContain(`removeLayer:${REFERENCE_SOURCE_PREFIX}sendero:circle`);
    expect(calls).toContain(`removeSource:${REFERENCE_SOURCE_PREFIX}sendero`);
  });
});
