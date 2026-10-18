/**
 * Ingests OSM objects into a reference document, so the map can show data the
 * basemap schema cannot carry (named buildings, tourism POIs, historic sites).
 *
 * Usage:
 *   bun src/scripts/ingest-osm-references.ts --region=calamuchita --dry-run
 *   bun src/scripts/ingest-osm-references.ts --region=calamuchita --publish \
 *     --api=https://sonora-api-staging.sonora-api.workers.dev --admin-key=$ADMIN_API_KEY
 *
 * Nothing is written unless --publish is passed. The script is idempotent: it
 * always produces the same document key for a region, so re-running it replaces
 * the document and its translations instead of duplicating them.
 */
import { writeFile } from 'node:fs/promises';

import { SUPPORTED_LANGUAGES, mapDocumentSchema, type MapReferenceFeature } from '@sonora/shared';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Overpass blocks generic clients, so the request identifies the application. */
const USER_AGENT = 'SonoraMapIngest/1.0 (+https://sonoraderivapoetica.com; contact: dev@sonora)';

const REGIONS: Record<string, { bbox: string; label: string }> = {
  calamuchita: { bbox: '-64.83,-32.28,-64.66,-32.12', label: 'Valle de Calamuchita' },
};

interface ClassSpec {
  /** Overpass selector, e.g. `building` or `tourism`. */
  key: string;
  /** Extra filter, e.g. `name` for named buildings. */
  filter?: string;
  minzoom: number;
  color: string;
}

const CLASSES: ClassSpec[] = [
  { key: 'building', filter: 'name', minzoom: 15, color: '#475569' },
  { key: 'tourism', minzoom: 13, color: '#0f766e' },
  { key: 'historic', minzoom: 13, color: '#7c3aed' },
  { key: 'amenity', minzoom: 14, color: '#b45309' },
  { key: 'shop', minzoom: 14, color: '#be123c' },
  { key: 'man_made', minzoom: 14, color: '#0369a1' },
];

interface Args {
  region: string;
  bbox: string;
  dryRun: boolean;
  api: string;
  adminKey: string | undefined;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const region = get('region') ?? 'calamuchita';
  const preset = REGIONS[region];
  if (!preset && !get('bbox')) {
    throw new Error(
      `unknown region "${region}"; pass --bbox=w,s,e,n or one of: ${Object.keys(REGIONS).join(', ')}`,
    );
  }

  return {
    region,
    bbox: get('bbox') ?? preset.bbox,
    dryRun: !argv.includes('--publish'),
    api: (get('api') ?? 'https://sonora-api-staging.sonora-api.workers.dev').replace(/\/$/, ''),
    adminKey: get('admin-key') ?? process.env.ADMIN_API_KEY,
  };
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function queryOverpass(bbox: string): Promise<OverpassElement[]> {
  // El bbox se recibe como w,s,e,n (igual que en el resto del proyecto) pero
  // Overpass espera s,w,n,e.
  const [west, south, east, north] = bbox.split(',').map(Number);
  const overpassBbox = `${south},${west},${north},${east}`;

  const selectors = CLASSES.map(
    (spec) => `nwr["${spec.key}"]${spec.filter ? `["${spec.filter}"]` : ''}(${overpassBbox});`,
  ).join('\n  ');

  const query = `[out:json][timeout:180];\n(\n  ${selectors}\n);\nout tags center;`;
  let lastError: unknown;

  // El servicio público se satura seguido y responde 429/502/504: reintentar es
  // parte del uso esperado, con espera creciente.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'user-agent': USER_AGENT,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ data: query }).toString(),
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const payload = (await response.json()) as { elements?: OverpassElement[] };
        console.log(
          `overpass    ${payload.elements?.length ?? 0} elementos desde ${new URL(endpoint).host}`,
        );
        return payload.elements ?? [];
      } catch (error) {
        lastError = error;
      }
    }
    const waitMs = 5000 * (attempt + 1);
    console.log(`overpass    ocupado, reintento en ${waitMs / 1000}s (${String(lastError)})`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error(`overpass no respondió: ${String(lastError)}`);
}

/** Clase con la que se pinta un elemento, por prioridad de la lista. */
function classFor(element: OverpassElement): ClassSpec | null {
  const tags = element.tags ?? {};
  return CLASSES.find((spec) => tags[spec.key] !== undefined) ?? null;
}

/** Stable, collision-free key for a label: two places can share a name. */
function labelKeyFor(element: OverpassElement): string {
  return `map.osm.${element.type}${element.id}`;
}

function featureFor(element: OverpassElement, spec: ClassSpec): MapReferenceFeature | null {
  const name = element.tags?.name?.trim();
  const coordinates = element.center
    ? ([element.center.lon, element.center.lat] as [number, number])
    : element.lat !== undefined && element.lon !== undefined
      ? ([element.lon, element.lat] as [number, number])
      : null;

  if (!name || !coordinates || name.length > 120) return null;

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
      labelKey: labelKeyFor(element),
      color: spec.color,
      minzoom: spec.minzoom,
    },
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const preset = REGIONS[args.region];
  const documentKey = `osm-${args.region}`;

  console.log(`region      ${args.region}${preset ? ` (${preset.label})` : ''}`);
  console.log(`bbox        ${args.bbox}`);
  console.log(`document    ${documentKey}`);
  console.log(
    `mode        ${args.dryRun ? 'DRY RUN (nothing is written)' : `PUBLISH to ${args.api}`}`,
  );
  console.log('');

  const features: MapReferenceFeature[] = [];
  const translations = new Map<string, string>();
  const byClass = new Map<string, number>();
  const seen = new Set<string>();

  const elements = await queryOverpass(args.bbox);

  for (const element of elements) {
    const identity = `${element.type}/${element.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const spec = classFor(element);
    if (!spec) continue;

    const feature = featureFor(element, spec);
    if (!feature) continue;

    features.push(feature);
    translations.set(feature.properties.labelKey, element.tags?.name?.trim() ?? '');
    byClass.set(spec.key, (byClass.get(spec.key) ?? 0) + 1);
  }

  for (const spec of CLASSES) {
    console.log(`${spec.key.padEnd(10)} ${String(byClass.get(spec.key) ?? 0).padStart(4)} usables`);
  }

  const document = mapDocumentSchema.safeParse({
    key: documentKey,
    scope: 'global',
    zIndex: 0,
    version: 1,
    collection: { type: 'FeatureCollection', features },
  });

  if (!document.success) {
    console.error('\nel documento no pasa el schema:', document.error.issues.slice(0, 5));
    process.exit(1);
  }

  const payloads = [...translations.entries()].flatMap(([key, value]) =>
    SUPPORTED_LANGUAGES.map((lang) => ({ lang, key, value })),
  );

  console.log('');
  console.log(`features      ${features.length}`);
  console.log(
    `traducciones  ${payloads.length} (${translations.size} claves × ${SUPPORTED_LANGUAGES.length} idiomas)`,
  );
  console.log(`documento     ${(JSON.stringify(document.data).length / 1024).toFixed(1)} kB`);
  console.log('');
  console.log(argv.includes('--list') ? 'etiquetas:' : 'muestra:');
  const listed = argv.includes('--list') ? features : features.slice(0, 6);
  for (const feature of listed) {
    const name = translations.get(feature.properties.labelKey);
    console.log(`  ${feature.properties.labelKey.padEnd(24)} ${name}`);
  }

  const out = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--out='))
    ?.split('=')[1];
  if (out) {
    await writeFile(out, JSON.stringify(document.data.collection, null, 2));
    console.log(`\ncolección escrita en ${out} (para inspección o para el visor)`);
  }

  // Mapa clave→texto, para que un visor local pueda resolver las etiquetas igual
  // que lo hace withResolvedLabels con i18n en la app.
  const labelsOut = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--labels-out='))
    ?.split('=')[1];
  if (labelsOut) {
    await writeFile(labelsOut, JSON.stringify(Object.fromEntries(translations), null, 2));
    console.log(`etiquetas escritas en ${labelsOut}`);
  }

  if (args.dryRun) {
    console.log(
      '--dry-run: no se escribió nada en la infraestructura. Agregá --publish para publicar.',
    );
    return;
  }

  if (!args.adminKey) {
    console.error('\nFalta la clave de admin: pasá --admin-key=… o exportá ADMIN_API_KEY.');
    process.exit(1);
  }

  const headers = { 'content-type': 'application/json', authorization: `Bearer ${args.adminKey}` };

  // El endpoint acepta 500 entradas por request; se envía en tandas.
  for (let index = 0; index < payloads.length; index += 500) {
    const chunk = payloads.slice(index, index + 500);
    const response = await fetch(`${args.api}/translations`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(chunk),
    });
    if (!response.ok)
      throw new Error(`translations failed: ${response.status} ${await response.text()}`);
    console.log(
      `traducciones  ${chunk.length} escritas (${index + chunk.length}/${payloads.length})`,
    );
  }

  const response = await fetch(`${args.api}/map-documents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key: documentKey,
      scope: 'global',
      zIndex: 0,
      version: 1,
      collection: document.data.collection,
      published: true,
      experienceIds: [],
    }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`map-documents failed: ${response.status} ${body}`);
  console.log(`documento     publicado: ${body.slice(0, 200)}`);
}

await main();
