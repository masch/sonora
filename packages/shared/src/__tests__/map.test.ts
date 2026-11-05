import { describe, expect, it } from 'vitest';

import {
  applyMapDocuments,
  boundsOfDocuments,
  buildReferenceStyleLayers,
  isAllowedHttpsUrl,
  ITINERARY_DOCUMENT_KEY,
  labelAnchorForDocument,
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

  it('rejects non-https card links', () => {
    const link = documentWith('enlace-inseguro', [
      { ...point, properties: { labelKey: 'map.a', linkUrl: 'http://example.com' } },
    ]);

    expect(() => parseMapDocument(link)).toThrow();
  });

  it('accepts a card image url, leaving the origin rule to the API', () => {
    const image = documentWith('imagen', [
      {
        ...point,
        properties: { labelKey: 'map.a', imageUrl: 'http://localhost/media/public/x.png' },
      },
    ]);

    expect(() => parseMapDocument(image)).not.toThrow();
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

  it('accepts a positive integer label index and rejects anything else', () => {
    const indexed = documentWith('serie', [
      { ...point, properties: { labelKey: 'map.point', labelIndex: 2 } },
    ]);
    expect(() => parseMapDocument(indexed)).not.toThrow();

    expect(() =>
      parseMapDocument(
        documentWith('cero', [{ ...point, properties: { labelKey: 'map.point', labelIndex: 0 } }]),
      ),
    ).toThrow();
    expect(() =>
      parseMapDocument(
        documentWith('medio', [
          { ...point, properties: { labelKey: 'map.point', labelIndex: 1.5 } },
        ]),
      ),
    ).toThrow();
  });

  it('accepts the camelCase label keys the app locales use', () => {
    // The locales name their map keys in camelCase (`map.userLocation`,
    // `map.offlineTitle`), so the pattern has to accept them: the authored
    // documents and the derived itinerary share this schema.
    const camelCase = documentWith('itinerario', [
      { ...point, properties: { labelKey: 'map.userLocation' } },
    ]);
    expect(() => parseMapDocument(camelCase)).not.toThrow();
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

    expect(resolved.collection.features[0].properties.labelText).toBe('Taller');
    expect(resolved.collection.features[1].properties.labelText).toBe('Sendero');
  });

  it('falls back to the key itself when the translation is missing', () => {
    const resolved = withResolvedLabels(documentWith('sendero', [point]), (key) => key);

    expect(resolved.collection.features[0].properties.labelText).toBe('map.references.taller');
  });

  it('interpolates the label index into the translation options', () => {
    const indexed = documentWith('serie', [
      { ...point, properties: { labelKey: 'map.point', labelIndex: 3 } },
    ]);

    const resolved = withResolvedLabels(indexed, (key, options) =>
      key === 'map.point' ? `Pt ${(options as { index: number }).index}` : key,
    );

    expect(resolved.collection.features[0].properties.labelText).toBe('Pt 3');
  });
});

describe('self-contained reference text', () => {
  const card = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
    properties: {
      label: { es: 'Salón', en: 'Hall' },
      description: { es: 'Donde empieza', en: 'Where it begins' },
    },
  };

  it('accepts a reference that carries its own text in every language', () => {
    expect(() => parseMapDocument(documentWith('fichas', [card]))).not.toThrow();
  });

  it('rejects a label block that leaves one language without text', () => {
    const partial = documentWith('fichas', [{ ...point, properties: { label: { es: 'Salón' } } }]);

    expect(() => parseMapDocument(partial)).toThrow();
  });

  it('rejects a reference that carries both its own text and a key', () => {
    const both = documentWith('fichas', [
      { ...point, properties: { labelKey: 'map.a', label: { es: 'A', en: 'A' } } },
    ]);

    expect(() => parseMapDocument(both)).toThrow();
  });
});

describe('label resolution for self-contained text', () => {
  const card = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
    properties: {
      label: { es: 'Salón', en: 'Hall' },
      description: { es: 'Donde empieza', en: 'Where it begins' },
    },
  };
  const translate = (key: string) => `traducido:${key}`;

  it('draws the text the document carries for the active language', () => {
    const resolved = withResolvedLabels(documentWith('fichas', [card]), translate, 'en');

    expect(resolved.collection.features[0].properties.labelText).toBe('Hall');
  });

  it('resolves the description in that language without the translation layer', () => {
    const resolved = withResolvedLabels(documentWith('fichas', [card]), translate, 'es');

    expect(resolved.collection.features[0].properties.descriptionText).toBe('Donde empieza');
  });

  it('falls back to the default language when the caller passes none', () => {
    const resolved = withResolvedLabels(documentWith('fichas', [card]), translate);

    expect(resolved.collection.features[0].properties.labelText).toBe('Salón');
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
    expect(layers[3].layout).toMatchObject({ 'text-field': ['get', 'labelText'] });
  });

  it('gates every layer on the zoom the feature asks for', () => {
    const layers = buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`);

    for (const layer of layers) {
      expect(layer.filter).toContainEqual(['>=', ['zoom'], ['coalesce', ['get', 'minzoom'], 0]]);
    }
  });

  it('culls a label that would land on another one', () => {
    // With overlap allowed, two documents describing the same place draw their
    // labels into the same pixels and the result reads as a corrupted word.
    const label = buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`).find((layer) =>
      layer.id.endsWith(':label'),
    );

    expect(label?.layout?.['text-allow-overlap']).toBe(false);
  });

  it('anchors the itinerary on the opposite side of a reference', () => {
    // The two can describe the same point: the first stop of a walk and the place
    // it enters. Opposing anchors are what makes both readable.
    const labelOf = (anchor: 'top' | 'bottom') =>
      buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`, { labelAnchor: anchor }).find(
        (layer) => layer.id.endsWith(':label'),
      );

    expect(labelOf('top')?.layout?.['text-anchor']).toBe('top');
    expect(labelOf('bottom')?.layout?.['text-anchor']).toBe('bottom');
    // The offset follows the anchor, or the text would sit on the point it names.
    expect(labelOf('top')?.layout?.['text-offset']).toEqual([0, 0.8]);
    expect(labelOf('bottom')?.layout?.['text-offset']).toEqual([0, -0.8]);
  });

  it('gives each document the anchor its content asks for', () => {
    expect(labelAnchorForDocument(ITINERARY_DOCUMENT_KEY)).toBe('bottom');
    expect(labelAnchorForDocument('referencias')).toBe('top');
  });

  it('lets a movable label try all four sides of its point', () => {
    // Crowded worlds — three experiences a couple of hundred metres apart — lose all
    // but one label when the only position is "below the point". A movable label
    // moves around it instead of disappearing.
    const movable = buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`, {
      movableLabels: true,
    }).find((layer) => layer.id.endsWith(':label'));

    expect(movable?.layout?.['text-variable-anchor']).toEqual(['left', 'right', 'top', 'bottom']);
    expect(movable?.layout?.['text-radial-offset']).toBe(0.25);
    // A label that moves to the side sticks out sideways, and its width comes from the
    // title. Capping it is what keeps the horizontal extent something the fit can size.
    expect(movable?.layout?.['text-max-width']).toBe(8);
    // Smaller at the wide frame the world opens on, full size once the walker zooms:
    // a crowd of labels is a size problem before it is a placement problem.
    expect(movable?.layout?.['text-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      13,
      10,
      15,
      12,
    ]);
    // The trip is placed first, so the label of the paid experience survives a crowd.
    expect(movable?.layout?.['symbol-sort-key']).toEqual(['coalesce', ['get', 'sortKey'], 0]);
    // A fixed anchor and a variable one are mutually exclusive.
    expect(movable?.layout?.['text-anchor']).toBeUndefined();
    expect(movable?.layout?.['text-offset']).toBeUndefined();
    // Still culled when all four sides are taken: that is what keeps two labels from
    // drawing on top of each other and reading as one corrupted word.
    expect(movable?.layout?.['text-allow-overlap']).toBe(false);
  });

  it('omits the label layer when the style has no glyphs source', () => {
    const layers = buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`, {
      includeLabels: false,
    });

    expect(layers.map((layer) => layer.id)).toEqual([
      `${REFERENCE_SOURCE_PREFIX}sendero:fill`,
      `${REFERENCE_SOURCE_PREFIX}sendero:line`,
      `${REFERENCE_SOURCE_PREFIX}sendero:circle`,
    ]);
  });

  it('draws exactly today’s layers when bold is not asked for', () => {
    // Only the world hub asks for the emphasised markers, so the default is what every
    // other map draws and it has to stay today's map pixel for pixel: same layers, same
    // order, same numbers, no extra target. Written out in full, so a later change to
    // the bold branch cannot ride along with the plain one.
    expect(buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`)).toEqual([
      {
        id: `${REFERENCE_SOURCE_PREFIX}sendero:fill`,
        type: 'fill',
        source: `${REFERENCE_SOURCE_PREFIX}sendero`,
        filter: [
          'all',
          ['==', ['geometry-type'], 'Polygon'],
          ['>=', ['zoom'], ['coalesce', ['get', 'minzoom'], 0]],
        ],
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#065f46'],
          'fill-opacity': 0.25,
          'fill-outline-color': ['coalesce', ['get', 'color'], '#065f46'],
        },
      },
      {
        id: `${REFERENCE_SOURCE_PREFIX}sendero:line`,
        type: 'line',
        source: `${REFERENCE_SOURCE_PREFIX}sendero`,
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['>=', ['zoom'], ['coalesce', ['get', 'minzoom'], 0]],
        ],
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#065f46'],
          'line-width': 3,
          'line-opacity': 0.9,
        },
      },
      {
        id: `${REFERENCE_SOURCE_PREFIX}sendero:circle`,
        type: 'circle',
        source: `${REFERENCE_SOURCE_PREFIX}sendero`,
        filter: [
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['>=', ['zoom'], ['coalesce', ['get', 'minzoom'], 0]],
        ],
        paint: {
          'circle-color': ['coalesce', ['get', 'color'], '#065f46'],
          'circle-radius': 6,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      },
      {
        id: `${REFERENCE_SOURCE_PREFIX}sendero:label`,
        type: 'symbol',
        source: `${REFERENCE_SOURCE_PREFIX}sendero`,
        filter: [
          'all',
          ['==', ['geometry-type'], 'Point'],
          ['>=', ['zoom'], ['coalesce', ['get', 'minzoom'], 0]],
        ],
        layout: {
          'text-field': ['get', 'labelText'],
          'text-font': ['Noto Sans Regular'],
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-size': 12,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': [
            'coalesce',
            ['get', 'labelColor'],
            ['coalesce', ['get', 'color'], '#065f46'],
          ],
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        },
      },
    ]);
  });

  it('adds the tap target and the heavier marker when bold is asked for', () => {
    const layers = buildReferenceStyleLayers(`${REFERENCE_SOURCE_PREFIX}sendero`, { bold: true });
    const layerWith = (id: string) => layers.find((layer) => layer.id === id);

    // The target is named after the document and drawn before the dot, because the map
    // draws in insertion order and a press asks which reference layer was touched.
    expect(layers.map((layer) => layer.id)).toEqual([
      `${REFERENCE_SOURCE_PREFIX}sendero:fill`,
      `${REFERENCE_SOURCE_PREFIX}sendero:line`,
      `${REFERENCE_SOURCE_PREFIX}sendero:circle-hit`,
      `${REFERENCE_SOURCE_PREFIX}sendero:circle`,
      `${REFERENCE_SOURCE_PREFIX}sendero:label`,
    ]);
    expect(layerWith(`${REFERENCE_SOURCE_PREFIX}sendero:circle-hit`)?.paint).toMatchObject({
      'circle-radius': 16,
      'circle-opacity': 0.01,
    });
    expect(layerWith(`${REFERENCE_SOURCE_PREFIX}sendero:circle`)?.paint).toMatchObject({
      'circle-radius': 6,
      'circle-stroke-width': 2,
    });
    expect(layerWith(`${REFERENCE_SOURCE_PREFIX}sendero:label`)?.paint?.['text-halo-width']).toBe(
      3,
    );
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

  it('reconciles documents in zIndex order so draw order is deterministic', () => {
    const { map, calls } = createFakeMap();

    applyMapDocuments(map, [
      { ...documentWith('arriba', [point]), zIndex: 10 },
      { ...documentWith('abajo', [point]), zIndex: 1 },
      { ...documentWith('medio', [point]) },
    ]);

    expect(calls.filter((call) => call.startsWith('addSource:'))).toEqual([
      `addSource:${REFERENCE_SOURCE_PREFIX}medio`,
      `addSource:${REFERENCE_SOURCE_PREFIX}abajo`,
      `addSource:${REFERENCE_SOURCE_PREFIX}arriba`,
    ]);
  });

  it('removes the label layer when labels are turned off, and adds it back when they return', () => {
    const { map, layers } = createFakeMap();
    const documents = [documentWith('sendero', [point])];

    applyMapDocuments(map, documents);
    expect(layers.map((layer) => layer.id)).toContain(`${REFERENCE_SOURCE_PREFIX}sendero:label`);

    applyMapDocuments(map, documents, { includeLabels: false });
    expect(layers.map((layer) => layer.id)).not.toContain(
      `${REFERENCE_SOURCE_PREFIX}sendero:label`,
    );
    // The non-label layers of the same source must survive the toggle.
    expect(layers.map((layer) => layer.id)).toContain(`${REFERENCE_SOURCE_PREFIX}sendero:circle`);

    applyMapDocuments(map, documents);
    expect(layers.map((layer) => layer.id)).toContain(`${REFERENCE_SOURCE_PREFIX}sendero:label`);
  });

  it('removes the west-side label too when labels are turned off', () => {
    // The hub draws its names in two layers, one per side of the card. A rule that only
    // knew `:label` left the eastern name on screen after the walker hid the labels.
    const { map, layers } = createFakeMap();
    const document = documentWith('sendero', [point]);
    applyMapDocuments(map, [document], { bold: true });
    layers.push({ id: `${REFERENCE_SOURCE_PREFIX}sendero:label-west`, source: 'sendero' });

    applyMapDocuments(map, [document], { includeLabels: false });

    expect(layers.map((layer) => layer.id)).not.toContain(
      `${REFERENCE_SOURCE_PREFIX}sendero:label-west`,
    );
    expect(layers.map((layer) => layer.id)).toContain(`${REFERENCE_SOURCE_PREFIX}sendero:circle`);
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
