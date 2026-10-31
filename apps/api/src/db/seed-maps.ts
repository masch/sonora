/**
 * Seeds the reference documents that only staging gets.
 *
 * The staging seed already knows it is staging (`assertSeedEnv`), so a map that must
 * never reach production belongs here and not in a script someone runs by hand: the
 * only entry point is `bun run db:seed:staging`, which refuses any other environment.
 *
 * A file is a self-contained reference document — the text travels inside it, in every
 * language — so seeding one writes `map_documents` and its bindings and **no** row in
 * `translations`. The authoring shape is the same one the publisher reads, and it is
 * mapped by the same function (`deriveDocument`), so the two paths cannot drift.
 *
 * A document that names translation keys instead is refused rather than seeded: its
 * rows would have to exist already, and a seed that silently leaves them out draws raw
 * keys on the map. Those documents are published by the ingestion path, which carries
 * their text with them.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  boundsOfDocuments,
  imageRejectionReason,
  linkRejectionReason,
  logger,
  type MapDocument,
} from '@sonora/shared';
import { eq } from 'drizzle-orm';

import { deriveDocument, type DocumentMetadata } from '../scripts/publish-map-document';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from './schema';
import { mapDocumentBindings, mapDocuments, type NewMapDocument } from './schema';

/** Where the staging-only documents live, beside the seed that reads them. */
const STAGING_MAPS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), 'staging-maps');

/** One seeded document plus the experiences its file binds it to. */
export interface SeedMapDocument {
  document: MapDocument;
  experienceIds: string[];
  published: boolean;
}

/**
 * Reads every `.geojson` of a directory, in filename order so a seed run is stable.
 * Pure apart from the reads: no database, no network.
 */
export function loadSeedDocuments(dir: string = STAGING_MAPS_DIRECTORY): SeedMapDocument[] {
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.geojson'))
    .sort();

  return files.map((file) => {
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown>;
    const metadata = (raw.sonora ?? {}) as DocumentMetadata;

    let derived;
    try {
      derived = deriveDocument(raw, metadata);
    } catch (error) {
      // The file name is the only thing the schema cannot say: it sees the document.
      throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const { document, keyBased } = derived;
    if (keyBased > 0) {
      throw new Error(
        `${file}: ${keyBased} reference(s) name translation keys; a seeded map must carry ` +
          'its own text (label/description per language) so it needs no translations table',
      );
    }

    // The same two rules the write route applies before storing a document. A seeded
    // map that the endpoint would reject is not publishable content, and the seed is a
    // second write path, not an exemption from the first one's policy.
    const rejection = linkRejectionReason(document) ?? imageRejectionReason(document);
    if (rejection !== null) {
      throw new Error(`${file}: ${rejection}`);
    }

    return {
      document,
      experienceIds: document.scope === 'experience' ? (metadata.experienceIds ?? []) : [],
      published: metadata.published ?? true,
    };
  });
}

/**
 * Writes the documents and rebuilds their bindings.
 *
 * The seed owns its documents outright — a re-run replaces them and drops the bindings
 * the file no longer names — which is what makes it idempotent and what keeps a
 * document edited out of a file from lingering in the database.
 *
 * The document and its bindings are written in **one transaction**. Idempotence is not
 * atomicity: three separate writes leave a window where the bindings are gone and the
 * next insert fails, and a published document with no bindings hides the map from its
 * experience until someone re-runs the seed. `NodePgDatabase` is the type that can
 * promise this — `neon-http` has no interactive transactions, which is why the route
 * reconciles by difference instead.
 */
export async function seedMapDocuments(
  db: NodePgDatabase<typeof schema>,
  documents: readonly SeedMapDocument[],
): Promise<void> {
  if (documents.length === 0) {
    logger.info('No staging map documents to seed.');
    return;
  }

  for (const seeded of documents) {
    const { document, experienceIds, published } = seeded;
    const bounds = boundsOfDocuments([document]);
    if (bounds === null) {
      throw new Error(`${document.key}: the document has no features to draw`);
    }

    const values: NewMapDocument = {
      key: document.key,
      scope: document.scope,
      zIndex: document.zIndex ?? 0,
      version: document.version ?? 1,
      collection: document.collection,
      bboxWest: bounds.west,
      bboxSouth: bounds.south,
      bboxEast: bounds.east,
      bboxNorth: bounds.north,
      published,
      updatedAt: new Date(),
    };

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(mapDocuments)
        .values(values)
        .onConflictDoUpdate({ target: mapDocuments.key, set: values })
        .returning();

      await tx.delete(mapDocumentBindings).where(eq(mapDocumentBindings.documentId, row.id));
      if (experienceIds.length > 0) {
        await tx
          .insert(mapDocumentBindings)
          .values(experienceIds.map((experienceId) => ({ documentId: row.id, experienceId })));
      }
    });

    logger.info(
      `Seeded map document ${document.key} (${document.scope}, ` +
        `${document.collection.features.length} features, ${experienceIds.length} bindings)`,
    );
  }
}
