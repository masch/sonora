import { afterEach, describe, expect, it, vi } from 'vitest';

import app, { setDbClient } from '../index';

const BINDINGS = { ADMIN_API_KEY: 'test-admin-key-123' };

const collection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
      properties: { labelKey: 'map.references.taller' },
    },
  ],
};

const validBody = {
  key: 'umepay',
  scope: 'experience',
  collection,
  experienceIds: ['11111111-1111-4111-8111-111111111111'],
  published: true,
};

interface MockOptions {
  /** `lang:key` pairs that exist in the translations table. */
  translations?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial drizzle double, as in the sibling suites
function createMockDb(options: MockOptions = {}): any {
  const inserts: { values: unknown }[] = [];
  const documentRow = {
    id: 'doc-1',
    key: validBody.key,
    scope: validBody.scope,
    zIndex: 0,
    version: 1,
    collection,
    published: true,
  };

  const rows = (options.translations ?? []).map((entry) => {
    const [lang, key] = entry.split(':');
    return { lang, key };
  });

  return {
    inserts,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(rows)),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        inserts.push({ values });
        return {
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
          onConflictDoUpdate: () => ({ returning: () => Promise.resolve([documentRow]) }),
        };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(undefined)) })),
  };
}

describe('POST /map-documents', () => {
  afterEach(() => {
    setDbClient(null);
  });

  it('rejects the write when the label key has no translation in both locales', async () => {
    const mockDb = createMockDb({ translations: ['es:map.references.taller'] });
    setDbClient(mockDb);

    const res = await app.request(
      '/map-documents',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${BINDINGS.ADMIN_API_KEY}`,
        },
        body: JSON.stringify(validBody),
      },
      BINDINGS,
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; errors?: { message: string }[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors?.[0].message).toContain('missing translations');
    expect(body.errors?.[0].message).toContain('map.references.taller');
  });

  it('stores the document with its bbox and bindings when both locales carry the key', async () => {
    const mockDb = createMockDb({
      translations: ['es:map.references.taller', 'en:map.references.taller'],
    });
    setDbClient(mockDb);

    const res = await app.request(
      '/map-documents',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${BINDINGS.ADMIN_API_KEY}`,
        },
        body: JSON.stringify(validBody),
      },
      BINDINGS,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      key: string;
      experienceIds: string[];
    };
    expect(body.key).toBe('umepay');
    expect(body.experienceIds).toEqual(validBody.experienceIds);

    const documentInsert = mockDb.inserts[0].values as {
      bboxWest: number;
      bboxEast: number;
      published: boolean;
    };
    expect(documentInsert.bboxWest).toBe(-64.738);
    expect(documentInsert.bboxEast).toBe(-64.738);
    expect(documentInsert.published).toBe(true);
  });

  it('rejects a card link whose host is not allowlisted', async () => {
    const mockDb = createMockDb({
      translations: ['es:map.references.taller', 'en:map.references.taller'],
    });
    setDbClient(mockDb);

    const res = await app.request(
      '/map-documents',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${BINDINGS.ADMIN_API_KEY}`,
        },
        body: JSON.stringify({
          ...validBody,
          collection: {
            ...collection,
            features: [
              {
                ...collection.features[0],
                properties: {
                  labelKey: 'map.references.taller',
                  linkUrl: 'https://evil.example.com/x',
                },
              },
            ],
          },
        }),
      },
      BINDINGS,
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors?: { message: string }[] };
    expect(body.errors?.[0].message).toContain('not allowlisted');
  });

  it('rejects an instagram link that points to another profile', async () => {
    const mockDb = createMockDb({
      translations: ['es:map.references.taller', 'en:map.references.taller'],
    });
    setDbClient(mockDb);

    const res = await app.request(
      '/map-documents',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${BINDINGS.ADMIN_API_KEY}`,
        },
        body: JSON.stringify({
          ...validBody,
          collection: {
            ...collection,
            features: [
              {
                ...collection.features[0],
                properties: {
                  labelKey: 'map.references.taller',
                  linkUrl: 'https://www.instagram.com/otro.perfil',
                },
              },
            ],
          },
        }),
      },
      BINDINGS,
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors?: { message: string }[] };
    expect(body.errors?.[0].message).toContain('sonora.derivapoetica');
  });

  it('rejects a global document that carries experience bindings', async () => {
    const mockDb = createMockDb({
      translations: ['es:map.references.taller', 'en:map.references.taller'],
    });
    setDbClient(mockDb);

    const res = await app.request(
      '/map-documents',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${BINDINGS.ADMIN_API_KEY}`,
        },
        body: JSON.stringify({ ...validBody, scope: 'global' }),
      },
      BINDINGS,
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors?: { message: string }[] };
    expect(body.errors?.[0].message).toContain('global documents take no experience bindings');
  });

  it('rejects the write without an admin session', async () => {
    setDbClient(createMockDb());

    const res = await app.request(
      '/map-documents',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody),
      },
      BINDINGS,
    );

    expect(res.status).toBe(401);
  });
});
