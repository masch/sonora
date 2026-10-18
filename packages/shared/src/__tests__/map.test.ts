import { describe, expect, it } from 'vitest';

import {
  applyMapDocuments,
  boundsOfDocuments,
  buildReferenceStyleLayers,
  isAllowedHttpsUrl,
  MAP_LINK_ALLOWED_HOSTS,
  MAP_REFERENCE_LIMITS,
  mapDocumentSchema,
  parseMapDocument,
  REFERENCE_SOURCE_PREFIX,
  withResolvedLabels,
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
  properties: { labelKey: 'map.references.taller' },
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
  properties: { labelKey: 'map.references.sendero' },
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
  properties: { labelKey: 'map.references.bosque' },
};

describe('map document schema', () => {
  it('accepts a document made of point, line and polygon references', () => {
    const parsed = mapDocumentSchema.parse(documentWith('sendero', [point, line, polygon]));

    expect(parsed.key).toBe('sendero');
    expect(parsed.collection.features).toHaveLength(3);
  });

  it('accepts an optional card image and external link', () => {
    const withCard = documentWith('ficha-completa', [
      {
        ...point,
        properties: {
          labelKey: 'map.references.taller',
          descriptionKey: 'map.references.taller.body',
          imageUrl: 'https://images.example.com/taller.jpg',
          linkUrl: 'https://www.openstreetmap.org/way/638440638',
        },
      },
    ]);

    expect(() => parseMapDocument(withCard)).not.toThrow();
  });

  it('rejects a reference without a label key', () => {
    expect(() =>
      parseMapDocument(documentWith('sin-clave', [{ ...point, properties: {} }])),
    ).toThrow();
  });

  it('rejects a label key outside the map namespace', () => {
    const broken = documentWith('clave-suelta', [{ ...point, properties: { labelKey: 'taller' } }]);

    expect(() => parseMapDocument(broken)).toThrow();
  });

  it('rejects non-https card images and links', () => {
    const image = documentWith('imagen-insegura', [
      { ...point, properties: { labelKey: 'map.a', imageUrl: 'http://example.com/a.jpg' } },
    ]);
    const link = documentWith('enlace-inseguro', [
      { ...point, properties: { labelKey: 'map.a', linkUrl: 'http://example.com' } },
    ]);

    expect(() => parseMapDocument(image)).toThrow();
    expect(() => parseMapDocument(link)).toThrow();
  });

  it('rejects geometries outside the supported subset', () => {
    const broken = documentWith('multipunto', [
      {
        type: 'Feature',
        geometry: { type: 'MultiPoint', coordinates: [[0, 0]] },
        properties: { labelKey: 'map.a' },
      },
    ]);

    expect(() => parseMapDocument(broken)).toThrow();
  });

  it('rejects documents over the feature limit', () => {
    const tooMany = Array.from({ length: MAP_REFERENCE_LIMITS.maxFeatures + 1 }, () => point);

    expect(() => parseMapDocument(documentWith('enorme', tooMany))).toThrow();
  });
});

describe('link allowlist', () => {
  it('accepts https URLs on allowed hosts and their subdomains', () => {
    expect(isAllowedHttpsUrl('https://openstreetmap.org/way/1', MAP_LINK_ALLOWED_HOSTS)).toBe(true);
    expect(isAllowedHttpsUrl('https://www.openstreetmap.org/way/1', MAP_LINK_ALLOWED_HOSTS)).toBe(
      true,
    );
    expect(
      isAllowedHttpsUrl('https://www.instagram.com/sonora.derivapoetica', MAP_LINK_ALLOWED_HOSTS),
    ).toBe(true);
    expect(
      isAllowedHttpsUrl('https://instagram.com/sonora.derivapoetica', MAP_LINK_ALLOWED_HOSTS),
    ).toBe(true);
  });

  it('rejects other hosts, plain http and malformed values', () => {
    expect(isAllowedHttpsUrl('https://evil.example.com/x', MAP_LINK_ALLOWED_HOSTS)).toBe(false);
    expect(isAllowedHttpsUrl('http://openstreetmap.org/way/1', MAP_LINK_ALLOWED_HOSTS)).toBe(false);
    expect(isAllowedHttpsUrl('not a url', MAP_LINK_ALLOWED_HOSTS)).toBe(false);
    expect(isAllowedHttpsUrl('https://openstreetmap.org.evil.com/x', MAP_LINK_ALLOWED_HOSTS)).toBe(
      false,
    );
    expect(isAllowedHttpsUrl('https://instagram.com.evil.com/x', MAP_LINK_ALLOWED_HOSTS)).toBe(
      false,
    );
    expect(isAllowedHttpsUrl('https://t.me/sonora.derivapoetica', MAP_LINK_ALLOWED_HOSTS)).toBe(
      false,
    );
  });
});

describe('label resolution', () => {
  it('injects the translated label into every feature', () => {
    const resolved = withResolvedLabels(documentWith('sendero', [point, line]), (key) =>
      key === 'map.references.taller' ? 'Taller' : 'Sendero',
    );

    expect(resolved.collection.features[0].properties.label).toBe('Taller');
    expect(resolved.collection.features[1].properties.label).toBe('Sendero');
  });

  it('falls back to the key itself when the translation is missing', () => {
    const resolved = withResolvedLabels(documentWith('sendero', [point]), (key) => key);

    expect(resolved.collection.features[0].properties.label).toBe('map.references.taller');
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
    // The map cannot translate keys, so it reads the label injected before drawing.
    expect(layers[3].layout).toMatchObject({ 'text-field': ['get', 'label'] });
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
