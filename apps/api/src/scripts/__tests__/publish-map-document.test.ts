import { describe, expect, it } from 'vitest';

import { deriveDocument, parseArgs } from '../publish-map-document';

/** A file-shaped collection; the text is what the mapping reads. */
function collection(features: unknown[]): unknown {
  return { type: 'FeatureCollection', features };
}

function point(properties: Record<string, unknown>): unknown {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-64.738, -32.211] },
    properties,
  };
}

const global = { key: 'deriva', scope: 'global' } as const;

describe('deriveDocument', () => {
  it('stores the document as authored, without reshaping its text', () => {
    const properties = {
      label: { es: 'Arroyo Mágico', en: 'Magic Creek' },
      description: { es: 'Cruza el sendero', en: 'Crosses the path' },
      linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
    };

    const { document, selfContained, keyBased } = deriveDocument(
      collection([point(properties)]),
      global,
    );

    expect(document.collection.features[0].properties).toEqual(properties);
    expect({ selfContained, keyBased }).toEqual({ selfContained: 1, keyBased: 0 });
  });

  it('refuses a label block that leaves a language without text', () => {
    expect(() => deriveDocument(collection([point({ label: { es: 'Salón' } })]), global)).toThrow(
      /properties\.label\.en Invalid input: expected string/,
    );
  });

  it('refuses a description block that leaves a language without text', () => {
    expect(() =>
      deriveDocument(
        collection([point({ label: { es: 'Salón', en: 'Hall' }, description: { en: 'Only' } })]),
        global,
      ),
    ).toThrow(/properties\.description\.es Invalid input: expected string/);
  });

  it('leaves a key-based feature untouched, because its rows already exist', () => {
    const { document, keyBased } = deriveDocument(
      collection([point({ labelKey: 'map.references.taller', color: '#475569' })]),
      global,
    );

    expect(document.collection.features[0].properties).toEqual({
      labelKey: 'map.references.taller',
      color: '#475569',
    });
    expect(keyBased).toBe(1);
  });

  it('counts a feature as key-based when any of its text still names a key', () => {
    const { selfContained, keyBased } = deriveDocument(
      collection([point({ label: { es: 'Salón', en: 'Hall' }, descriptionKey: 'map.a.body' })]),
      global,
    );

    expect({ selfContained, keyBased }).toEqual({ selfContained: 0, keyBased: 1 });
  });

  it('refuses a feature with neither text nor a key', () => {
    expect(() => deriveDocument(collection([point({})]), global)).toThrow(
      /a reference needs label or labelKey/,
    );
  });

  it('refuses a document that carries both text and a key', () => {
    expect(() =>
      deriveDocument(
        collection([point({ label: { es: 'Salón', en: 'Hall' }, labelKey: 'map.a' })]),
        global,
      ),
    ).toThrow(/exclusive/);
  });

  it('refuses a global document that carries bindings', () => {
    expect(() =>
      deriveDocument(collection([point({ label: { es: 'Salón', en: 'Hall' } })]), {
        key: 'deriva',
        scope: 'global',
        experienceIds: ['a23baa7e-2c82-472f-9241-4f23e00c1732'],
      }),
    ).toThrow(/no experience bindings/);
  });

  it('refuses a document the route would reject', () => {
    expect(() =>
      deriveDocument(collection([point({ label: { es: 'Salón', en: 'Hall' } })]), {
        key: 'Con Mayúsculas',
        scope: 'global',
      }),
    ).toThrow(/does not validate/);
  });
});

describe('parseArgs', () => {
  it('refuses --publish together with --dry-run instead of choosing one', () => {
    expect(() => parseArgs(['--file=x.geojson', '--publish', '--dry-run'])).toThrow(
      /--publish and --dry-run are exclusive/,
    );
  });

  it('publishes only when --publish is given', () => {
    expect(parseArgs(['--file=x.geojson']).publish).toBe(false);
    expect(parseArgs(['--file=x.geojson', '--publish']).publish).toBe(true);
    expect(parseArgs(['--file=x.geojson', '--dry-run']).publish).toBe(false);
  });
});
