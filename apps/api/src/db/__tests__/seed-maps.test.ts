import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { loadSeedDocuments, seedMapDocuments } from '../seed-maps';
import { baseExperiences } from '../seed-data';
import { mapDocumentBindings, mapDocuments } from '../schema';

/** A directory holding exactly the given files, for the refusals. */
function directoryWith(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'seed-maps-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(body));
  }
  return dir;
}

function point(properties: Record<string, unknown>): unknown {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-64.738, -32.211] },
    properties,
  };
}

describe('loadSeedDocuments', () => {
  it('reads the staging example with its own text and its bindings', () => {
    const [seeded] = loadSeedDocuments();
    const umepay = baseExperiences.find((experience) => experience.slug === 'umepay-bosque');

    expect(seeded.document.key).toBe('prueba-tarjeta');
    expect(seeded.document.scope).toBe('experience');
    expect(seeded.document.collection.features[0].properties.label?.es).toBe('Arroyo Mágico');
    expect(seeded.document.collection.features[0].properties.labelKey).toBeUndefined();
    // Bound to an experience the seed really creates, not to a copy of its id.
    expect(seeded.experienceIds).toEqual([umepay?.id]);
    expect(seeded.published).toBe(true);
  });

  it('refuses a document that names translation keys instead of carrying text', () => {
    const dir = directoryWith({
      'por-clave.geojson': {
        type: 'FeatureCollection',
        sonora: { key: 'por-clave', scope: 'global' },
        features: [point({ labelKey: 'map.references.taller' })],
      },
    });

    expect(() => loadSeedDocuments(dir)).toThrow(/name translation keys/);
  });

  it('names the file that has no sonora block', () => {
    const dir = directoryWith({
      'sin-meta.geojson': { type: 'FeatureCollection', features: [point({ label: 'Salón' })] },
    });

    expect(() => loadSeedDocuments(dir)).toThrow(/sin-meta\.geojson: the document needs a key/);
  });
});

describe('seedMapDocuments', () => {
  it('upserts the document with its computed bbox and rebuilds its bindings', async () => {
    const written: { table: unknown; values: unknown }[] = [];
    const deleted: unknown[] = [];

    // Every write must go through the transaction handle. The outer client throws if
    // one escapes it, so a code path that writes three statements separately fails here
    // instead of merely leaving an assertion unvisited.
    const handle = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          written.push({ table, values });
          return {
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn(() => Promise.resolve([{ id: 'doc-1' }])),
            })),
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(undefined).then(resolve),
          };
        }),
      })),
      delete: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          deleted.push(table);
          return Promise.resolve(undefined);
        }),
      })),
    };

    const outsideTheTransaction = (name: string) =>
      vi.fn(() => {
        throw new Error(`${name} was written outside the transaction`);
      });

    const db = {
      transaction: vi.fn((run: (tx: unknown) => Promise<unknown>) => run(handle)),
      insert: outsideTheTransaction('insert'),
      delete: outsideTheTransaction('delete'),
    };

    await seedMapDocuments(db as never, loadSeedDocuments());

    expect(db.transaction).toHaveBeenCalledOnce();

    const documentWrite = written.find((entry) => entry.table === mapDocuments);
    const values = documentWrite?.values as Record<string, unknown>;
    expect(values.key).toBe('prueba-tarjeta');
    expect(values.collection).toBeDefined();
    // The bbox is computed from the features, never authored by hand.
    expect(values.bboxWest).toBeCloseTo(-64.73809, 5);
    expect(values.bboxNorth).toBeCloseTo(-32.211913, 5);

    expect(deleted).toContain(mapDocumentBindings);
    const bindingWrite = written.find((entry) => entry.table === mapDocumentBindings);
    expect(bindingWrite?.values).toEqual([
      { documentId: 'doc-1', experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732' },
    ]);
  });
});
