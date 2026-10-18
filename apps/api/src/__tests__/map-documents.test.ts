import { afterEach, describe, expect, it, vi } from 'vitest';

import app, { setDbClient } from '../index';
import { SUPPORTED_LANGUAGES } from '@sonora/shared';
import { experiences, mapDocumentBindings, translations } from '../db/schema';

const BINDINGS = { ADMIN_API_KEY: 'test-admin-key-123' };

function postDocument(body: unknown) {
  return app.request(
    '/map-documents',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${BINDINGS.ADMIN_API_KEY}`,
      },
      body: JSON.stringify(body),
    },
    BINDINGS,
  );
}

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
  /** Experience ids that exist. */
  experiences?: string[];
  /** Experience ids the document is already bound to. */
  bindings?: string[];
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
  const experienceRows = (options.experiences ?? []).map((id) => ({ id }));
  const bindingRows = (options.bindings ?? []).map((experienceId) => ({ experienceId }));

  return {
    inserts,
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === translations) return Promise.resolve(rows);
          if (table === experiences) return Promise.resolve(experienceRows);
          if (table === mapDocumentBindings) return Promise.resolve(bindingRows);
          return Promise.resolve([]);
        }),
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
      experiences: [validBody.experienceIds[0]],
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

describe('POST /map-documents card images', () => {
  afterEach(() => {
    setDbClient(null);
  });

  function bodyWithImage(imageUrl: string) {
    return {
      ...validBody,
      collection: {
        ...collection,
        features: [
          {
            ...collection.features[0],
            properties: { labelKey: 'map.references.taller', imageUrl },
          },
        ],
      },
    };
  }

  const translations = ['es:map.references.taller', 'en:map.references.taller'];

  it('rejects a card image that does not come from our upload endpoint', async () => {
    setDbClient(createMockDb({ translations }));

    const res = await postDocument(bodyWithImage('https://evil.example.com/foto.jpg'));

    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors?: { message: string }[] };
    expect(body.errors?.[0].message).toContain('upload endpoint');
  });

  it('accepts a card image served from this origin', async () => {
    setDbClient(createMockDb({ translations, experiences: validBody.experienceIds as string[] }));

    const res = await postDocument(
      bodyWithImage('http://localhost/media/public/map-references/abc123.png'),
    );

    expect(res.status).toBe(201);
  });
});

describe('POST /map-documents bindings', () => {
  afterEach(() => {
    setDbClient(null);
  });

  const translations = ['es:map.references.taller', 'en:map.references.taller'];

  it('requires the key in every supported language, not just some of them', async () => {
    for (const missingLang of SUPPORTED_LANGUAGES) {
      const present = SUPPORTED_LANGUAGES.filter((lang) => lang !== missingLang).map(
        (lang) => `${lang}:map.references.taller`,
      );
      setDbClient(
        createMockDb({ translations: present, experiences: validBody.experienceIds as string[] }),
      );

      const res = await postDocument(validBody);

      expect(res.status).toBe(422);
      const body = (await res.json()) as { errors?: { message: string }[] };
      expect(body.errors?.[0].message).toContain('map.references.taller');
      expect(body.errors?.[0].message).toContain(missingLang);
    }
  });

  it('rejects a binding to an experience that does not exist', async () => {
    setDbClient(createMockDb({ translations }));

    const res = await postDocument(validBody);

    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors?: { path: string; message: string }[] };
    expect(body.errors?.[0].path).toBe('experienceIds');
    expect(body.errors?.[0].message).toContain('unknown experiences');
  });

  it('inserts only the bindings that are missing instead of rewriting them all', async () => {
    const alreadyBound = '22222222-2222-4222-8222-222222222222';
    const newlyBound = validBody.experienceIds[0];
    const mockDb = createMockDb({
      translations,
      experiences: [alreadyBound, newlyBound],
      bindings: [alreadyBound],
    });
    setDbClient(mockDb);

    const res = await postDocument({ ...validBody, experienceIds: [alreadyBound, newlyBound] });

    expect(res.status).toBe(201);
    const bindingInsert = mockDb.inserts[1].values as { experienceId: string }[];
    expect(bindingInsert).toEqual([{ documentId: 'doc-1', experienceId: newlyBound }]);
  });
});
