import { logger, sha256 } from '@sonora/shared';
import { inArray } from 'drizzle-orm';
import type { DbClient } from './index';
import type { NewExperience, NewTermsVersion, NewTheme, NewWaypoint } from './schema';
import {
  experiences as experiencesTable,
  termsVersions as termsVersionsTable,
  themes as themesTable,
  waypoints as waypointsTable,
} from './schema';

/**
 * Fail-closed SEED_ENV guard. Pure and unit-testable (no DB / no process
 * side effects beyond an intentional `process.exit` on refusal).
 *
 * - `staging` entry: refuses (exit 1) unless `seedEnv === 'staging'`.
 * - `base` entry: refuses (exit 1) when `seedEnv` is present and `!== 'production'`;
 *   an absent `seedEnv` (local dev) remains permitted.
 */
export function assertSeedEnv(entry: 'base' | 'staging', seedEnv: string | undefined): void {
  if (entry === 'staging' && seedEnv !== 'staging') {
    logger.error(
      `seed-staging.ts requires SEED_ENV=staging (got ${seedEnv ?? 'unset'}). Refusing to seed.`,
    );
    process.exit(1);
  }
  if (entry === 'base' && seedEnv !== undefined && seedEnv !== 'production') {
    logger.error(`seed.ts refuses SEED_ENV=${seedEnv} (expected 'production' or unset).`);
    process.exit(1);
  }
}

/** Pure: the set of experience IDs whose waypoints will be replaced (the delete scope). */
export function collectExperienceIds(experiences: readonly { id?: string }[]): string[] {
  return experiences.map((e) => e.id).filter((id): id is string => id != null);
}

export interface SeedData {
  themes: readonly NewTheme[];
  experiences: readonly NewExperience[];
  waypoints: readonly NewWaypoint[];
}

/**
 * Single-sourced upsert used by both the base (`seed.ts`) and staging
 * (`seed-staging.ts`) entries. Upserts themes then experiences, then replaces
 * waypoints ONLY for the provided experience IDs (union scope), leaving other
 * experiences' waypoints untouched. Idempotent on re-run.
 */
export async function seedExperiences(db: DbClient, data: SeedData): Promise<void> {
  const { themes, experiences, waypoints } = data;

  // 1. Upsert Themes (update if exists, insert if not)
  logger.info('Seeding themes...');
  for (const theme of themes) {
    await db
      .insert(themesTable)
      .values(theme)
      .onConflictDoUpdate({ target: themesTable.key, set: theme });
  }

  const seededExperienceIds = collectExperienceIds(experiences);

  // 2. Upsert Experiences (update if exists, insert if not)
  logger.info('Seeding experiences...');
  for (const exp of experiences) {
    await db
      .insert(experiencesTable)
      .values(exp)
      .onConflictDoUpdate({ target: experiencesTable.id, set: exp });
  }

  // 3. Replace waypoints only for seeded experiences (leave others untouched)
  if (seededExperienceIds.length > 0) {
    logger.info('Seeding waypoints...');
    await db
      .delete(waypointsTable)
      .where(inArray(waypointsTable.experienceId, seededExperienceIds as [string, ...string[]]));
    for (const wp of waypoints) {
      await db.insert(waypointsTable).values(wp);
    }
  }
}

export const defaultThemes: readonly NewTheme[] = [
  {
    key: 'birds',
    labelKey: 'experiences.categories.birds',
    order: 1,
    applicableFormat: 'track',
  },
  {
    key: 'landscapes',
    labelKey: 'experiences.categories.landscapes',
    order: 2,
    applicableFormat: 'trip',
  },
  {
    key: 'community',
    labelKey: 'experiences.categories.community',
    order: 3,
    applicableFormat: 'track',
  },
  {
    key: 'onboarding',
    labelKey: 'experiences.categories.onboarding',
    order: 4,
    applicableFormat: 'trip',
  },
];

const trips: readonly NewExperience[] = [
  {
    id: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    slug: 'umepay-bosque',
    title: 'DERIVA DEL BOSQUE AL RÍO',
    description: 'Deriva del bosque al río, 3 secciones, 600mts',
    format: 'trip',
    themeKey: 'landscapes',
    audioUrl: 'experiences/trips-deriva-centro.mp3',
    durationSeconds: 2539,
    latitude: -32.211913,
    longitude: -64.73809012343702,
    free: false,
    price: 2200000,
    currency: 'ARS',
    imageKey: 'trips-deriva-centro-cover',
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: true,
  },
];

const tracks: readonly NewExperience[] = [
  {
    id: '5a9463ce-daba-4756-892e-4dd4cb862309',
    slug: 'texto-maga',
    title: 'En Nogales, una vez',
    description: 'Maga',
    format: 'track',
    themeKey: 'community',
    audioUrl: 'experiences/tracks-texto-maga.mp3',
    durationSeconds: 193,
    latitude: -32.191576848045585,
    longitude: -64.75240243117017,
    free: true,
    imageKey: 'tracks-texto-maga-cover',
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: true,
  },
  {
    id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    slug: 'pajaros-chiricotes',
    title: 'Pájaros chiricotes',
    description: 'Pájaros chiricotes en el dique',
    format: 'track',
    themeKey: 'birds',
    audioUrl: 'experiences/tracks-pajaros-chiricotes.mp3',
    durationSeconds: 139,
    latitude: -32.2115,
    longitude: -64.7385,
    free: true,
    imageKey: 'tracks-pajaros-chiricotes-cover',
    geofenceBypassable: false,
    geoMode: 'formatDefaultRadius',
    radiusMeters: null,
    published: false,
  },
];

export const baseExperiences: readonly NewExperience[] = [...trips, ...tracks];

export const baseWaypoints: readonly NewWaypoint[] = [
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    order: 1,
    latitude: -32.212488,
    longitude: -64.736874,
    radiusMeters: 50,
  },
  {
    experienceId: 'a23baa7e-2c82-472f-9241-4f23e00c1732',
    order: 2,
    latitude: -32.21333,
    longitude: -64.736273,
    radiusMeters: 50,
  },
];

export const termsContentV2026_09_1 = `# Términos y Condiciones de Uso — Sonora

Bienvenido a Sonora. Al utilizar nuestra aplicación, aceptas las siguientes condiciones de uso:

1. **Uso de la Aplicación**: Sonora ofrece experiencias sonoras geolocalizadas destinadas a la exploración cultural y artística.
2. **Geolocalización y Privacidad**: La aplicación utiliza tu ubicación únicamente para activar los puntos sonoros en el territorio. No almacenamos tu historial de ubicación de forma identificable.
3. **Propiedad Intelectual**: Todas las pistas de audio, textos e imágenes son propiedad de sus respectivos autores y de Sonora. Queda prohibida su reproducción sin autorización.
4. **Modificaciones**: Sonora se reserva el derecho de actualizar estos términos en cualquier momento. El uso continuado de la app tras una actualización implica la aceptación de los nuevos términos.
`;

export const baseTerms: readonly NewTermsVersion[] = [
  {
    version: '2026.09.1',
    title: 'Términos y Condiciones de Uso',
    content: termsContentV2026_09_1,
    contentHash: await sha256(termsContentV2026_09_1),
    publishedAt: new Date('2026-09-14T00:00:00.000Z'),
  },
];

export async function seedTerms(db: DbClient, terms: readonly NewTermsVersion[]): Promise<void> {
  logger.info('Seeding terms versions...');
  for (const term of terms) {
    await db
      .insert(termsVersionsTable)
      .values(term)
      .onConflictDoNothing({ target: termsVersionsTable.version });
  }
}
