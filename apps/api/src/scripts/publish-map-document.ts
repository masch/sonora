/**
 * Publishes a self-contained reference document: the text travels inside the document,
 * in every language, so a copy change never touches the database's translation table
 * nor the codebase.
 *
 * A reference used to name a translation key, and the write path refused a document
 * whose keys had no row in `translations` for both locales. That kept the app's i18n
 * in one place but made every copy edit a second write, and left the document mute.
 * A document may now carry its own text instead — `label` and `description`, each
 * keyed by language — which excludes the keys and needs no row at all.
 *
 * The file is a **document, not a form to be reshaped**: what you edit is what gets
 * stored, so this script validates and publishes, and nothing else. It is still plain
 * GeoJSON, so it opens in any viewer; the document metadata rides in a foreign member
 * (`"sonora"`, RFC 7946 §6.1):
 *
 *   {
 *     "type": "FeatureCollection",
 *     "sonora": { "key": "prueba-tarjeta", "scope": "experience",
 *                 "experienceIds": ["…"], "published": true, "zIndex": 10 },
 *     "features": [
 *       { "type": "Feature",
 *         "geometry": { "type": "Point", "coordinates": [-64.73809, -32.211913] },
 *         "properties": {
 *           "label":       { "es": "Arroyo Mágico", "en": "Magic Creek" },
 *           "description": { "es": "El arroyo que cruza el sendero.",
 *                            "en": "The stream the path crosses." },
 *           "linkUrl": "https://www.instagram.com/sonora.derivapoetica"
 *         } }
 *     ]
 *   }
 *
 * Every supported language must be present: a gap is refused here, naming the locale,
 * instead of drawing a blank label in one language.
 *
 * A feature that carries a `labelKey` instead is published untouched: that form still
 * works and is what the OSM ingestion produces, and its rows must already exist — this
 * script writes no translation.
 *
 * Usage:
 *   bun src/scripts/publish-map-document.ts --file=../db/staging-maps/prueba-tarjeta.geojson --dry-run
 *   bun src/scripts/publish-map-document.ts --file=… --publish \
 *     --api=https://sonora-api-staging.sonora-api.workers.dev --admin-key=$ADMIN_API_KEY
 *
 * Nothing is written unless `--publish` is passed, and no flag can override what the
 * file says: the document key, scope, bindings and published state come from `sonora`.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_LANGUAGE, mapDocumentSchema, type MapDocument } from '@sonora/shared';

/** Fields the file may carry at document level, in its `sonora` foreign member. */
export interface DocumentMetadata {
  key: string;
  scope: 'global' | 'experience';
  zIndex?: number;
  version?: number;
  published?: boolean;
  experienceIds?: string[];
}

export interface Derived {
  document: MapDocument;
  /** Features whose text the document itself carries, for the run summary. */
  selfContained: number;
  /** Features that name a translation key instead. */
  keyBased: number;
}

/**
 * Validates the authoring file as the document it already is. Pure: no network, no
 * filesystem, so the rules are testable on their own.
 *
 * The per-feature rules are not repeated here. The schema the route validates with
 * already refuses a feature that names neither a text block nor a key, a block missing
 * a language, and a feature carrying both — and its path names the feature, so a
 * hand-authored mistake still points at the line to fix.
 */
export function deriveDocument(collection: unknown, metadata: DocumentMetadata): Derived {
  if (typeof metadata.key !== 'string' || metadata.key === '') {
    throw new Error('the document needs a key: set "sonora.key" in the file');
  }
  if (metadata.scope !== 'global' && metadata.scope !== 'experience') {
    throw new Error('the document needs a scope: set "sonora.scope" to global or experience');
  }
  if (metadata.scope === 'global' && (metadata.experienceIds ?? []).length > 0) {
    throw new Error('a global document takes no experience bindings');
  }

  const parsed = mapDocumentSchema.safeParse({
    key: metadata.key,
    scope: metadata.scope,
    ...(metadata.zIndex === undefined ? {} : { zIndex: metadata.zIndex }),
    ...(metadata.version === undefined ? {} : { version: metadata.version }),
    collection,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`the document does not validate: ${issue.path.join('.')} ${issue.message}`);
  }

  const document = parsed.data as MapDocument;
  // A feature is self-contained only when nothing about it needs the translations table:
  // `label` and `description` are authored independently, so a label block next to a
  // `descriptionKey` still costs a row and must not count as key-free.
  const keyBased = document.collection.features.filter(
    (feature) =>
      feature.properties.labelKey !== undefined || feature.properties.descriptionKey !== undefined,
  ).length;

  return {
    document,
    selfContained: document.collection.features.length - keyBased,
    keyBased,
  };
}

interface Args {
  file: string;
  api: string;
  adminKey: string | undefined;
  publish: boolean;
}

function flag(argv: string[], name: string): string | undefined {
  return argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

export function parseArgs(argv: string[]): Args {
  const file = flag(argv, 'file');
  if (file === undefined) throw new Error('--file=<path.geojson> is required');

  // `--dry-run` is documented, so it has to be read: with both flags the run would
  // otherwise publish while the caller believes it is previewing. Refusing is the only
  // honest answer to a request that says two opposite things.
  if (argv.includes('--publish') && argv.includes('--dry-run')) {
    throw new Error('--publish and --dry-run are exclusive: refusing to guess which one you meant');
  }

  return {
    file,
    api: (flag(argv, 'api') ?? 'https://sonora-api-staging.sonora-api.workers.dev').replace(
      /\/$/,
      '',
    ),
    adminKey: flag(argv, 'admin-key') ?? process.env.ADMIN_API_KEY,
    publish: argv.includes('--publish'),
  };
}

/** Reads the file and takes its document metadata from the `sonora` member. */
async function loadFile(path: string): Promise<{ derived: Derived; metadata: DocumentMetadata }> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  const metadata = (raw.sonora ?? {}) as DocumentMetadata;
  return { derived: deriveDocument(raw, metadata), metadata };
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const resolved = resolve(dirname(fileURLToPath(import.meta.url)), args.file);
  const { derived, metadata } = await loadFile(resolved);
  const { document, selfContained, keyBased } = derived;

  console.log(`file        ${resolved}`);
  console.log(`document    ${document.key} (${document.scope}, zIndex ${document.zIndex ?? 0})`);
  console.log(
    `features    ${document.collection.features.length}` +
      (document.scope === 'experience'
        ? ` · experiencias ${metadata.experienceIds?.length ?? 0}`
        : ' · sin bindings'),
  );
  console.log(
    `textos      ${selfContained} autocontenidos` +
      (keyBased === 0 ? ' (no se escribe ninguna traducción)' : ` · ${keyBased} por clave`),
  );
  for (const feature of document.collection.features) {
    const { label, labelKey } = feature.properties;
    const shown = label?.[DEFAULT_LANGUAGE] ?? labelKey ?? '';
    console.log(
      `  ${shown.padEnd(28)} ${label ? `[${Object.keys(label).join(', ')}]` : '[clave]'}`,
    );
  }

  if (!args.publish) {
    console.log('\n--dry-run: no se escribió nada. Agregá --publish para publicar.');
    return 0;
  }
  if (args.adminKey === undefined) {
    console.error('\nFalta la clave de admin: pasá --admin-key=… o exportá ADMIN_API_KEY.');
    return 1;
  }

  const response = await fetch(`${args.api}/map-documents`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${args.adminKey}`,
    },
    body: JSON.stringify({
      key: document.key,
      scope: document.scope,
      zIndex: document.zIndex ?? 0,
      version: document.version ?? 1,
      collection: document.collection,
      published: metadata.published ?? true,
      experienceIds: document.scope === 'experience' ? (metadata.experienceIds ?? []) : [],
    }),
  });

  if (!response.ok) {
    console.error(`\ndocumento falló: ${response.status} ${await response.text()}`);
    return 1;
  }
  const body = (await response.json()) as { data?: { key?: string } };
  console.log(`documento   publicado ${body.data?.key ?? document.key} en ${args.api}`);
  return 0;
}

const invoked = process.argv[1];
if (invoked !== undefined && resolve(invoked) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(
        `publish-map-document: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
