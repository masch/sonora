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
    credits: [
      {
        role: 'realization',
        names: 'Grupo Arquitectura del juego: Nachugo, Lucesypeces, Magali de Masi, Mara Ticach.',
      },
      { role: 'musicalEditing', names: 'Max Delanian.' },
      { role: 'treesMusic', names: 'Hila.musicadelasplantas' },
      {
        role: 'riverFeetSong',
        names: 'Mara Ticach, con colaboración de Clara Canale, Cande Czarnowska, Max Delanian.',
      },
      {
        role: 'oceanomarAudio',
        names: 'Matías Etcheguren sobre texto “ Océano mar” de Alessandro Baricco.',
      },
      { role: 'voices', names: 'Chantal, Rafaela, Mara, Maga, Max, Luz, Fede.' },
      { role: 'forestObjects', names: 'Lucesypeces.' },
    ],
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
    credits: [
      { role: 'text', names: 'Magali de Masi' },
      { role: 'voiceover', names: 'Mara Ticach' },
      { role: 'editing', names: 'Max Delanian' },
    ],
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

export const termsContentV2026_09_1_ES = `Sonora. Deriva poética

Al acceder y participar en una experiencia de Sonora. Deriva poética, acepto las siguientes condiciones:

1. Naturaleza de la experiencia

Sonora. Deriva poética es un proyecto artístico que propone recorridos y piezas sonoras para ser vividas de manera individual o colectiva. Su finalidad es estética, cultural y de exploración sensible del territorio.

La experiencia no constituye una actividad deportiva, terapéutica, médica ni psicológica, ni reemplaza ningún tratamiento profesional.

2. Participación voluntaria

Participo de manera libre y voluntaria, declarando que me encuentro en condiciones físicas y emocionales adecuadas para realizar el recorrido.

En cualquier momento puedo detener, pausar o abandonar la experiencia si así lo considero necesario.

3. Responsabilidad durante el recorrido

Comprendo que soy responsable de mi seguridad y de mis decisiones durante toda la experiencia.

Me comprometo a:

* respetar las normas de tránsito y convivencia;
* prestar atención permanente al entorno;
* detener la reproducción del audio cuando la situación requiera toda mi atención;
* respetar la propiedad privada, el patrimonio cultural y el ambiente;
* no ingresar a lugares restringidos o potencialmente peligrosos.

4. Riesgos

Entiendo que toda caminata o desplazamiento en espacios públicos o naturales implica riesgos propios, como desniveles, tránsito vehicular, superficies irregulares, condiciones climáticas, presencia de animales u otras situaciones imprevistas.

Asumo dichos riesgos bajo mi exclusiva responsabilidad.

Sonora. Deriva poética no será responsable por accidentes, lesiones, pérdidas, robos, daños materiales o cualquier otro perjuicio derivado de acciones, decisiones o circunstancias ocurridas durante la experiencia, salvo en aquellos casos en que la legislación aplicable establezca expresamente lo contrario.

5. Uso de la aplicación

La aplicación y sus contenidos son para uso personal.

No está permitido:

* copiar, reproducir o distribuir los audios, textos o materiales;
* modificar el contenido;
* utilizar la plataforma con fines comerciales sin autorización;
* intentar vulnerar el funcionamiento de la aplicación.

6. Propiedad intelectual

Todos los recorridos, relatos, textos, audios, música, imágenes, diseño, identidad visual y demás contenidos pertenecen a Sonora. Deriva poética o a sus respectivos autores y se encuentran protegidos por la legislación vigente sobre propiedad intelectual.

Su utilización requiere autorización previa, salvo los usos expresamente permitidos por la ley.

7. Privacidad

La aplicación podrá recopilar únicamente los datos necesarios para su funcionamiento y mejora, de acuerdo con su Política de Privacidad.

Los datos personales serán tratados con confidencialidad y no serán compartidos con terceros, salvo obligación legal o autorización expresa del usuario.

8. Geolocalización 
El usuario autoriza este uso únicamente para el funcionamiento de la experiencia y que puede revocar ese permiso desde la configuración de su dispositivo. 

9. Modificaciones

Sonora. Deriva poética podrá actualizar estos términos cuando resulte necesario. Las modificaciones regirán desde su publicación en la aplicación.

10. Aceptación

Al iniciar una experiencia mediante la aplicación, confirmo que he leído, comprendido y aceptado estos términos y condiciones, participando bajo mi propia responsabilidad.
`;

export const termsContentV2026_09_1_EN = `Sonora. Poetic Drift

By accessing and participating in a Sonora. Poetic Drift experience, I accept the following conditions:

1. Nature of the experience

Sonora. Poetic Drift is an artistic project that proposes routes and sound pieces to be experienced individually or collectively. Its purpose is aesthetic, cultural, and of sensitive exploration of the territory.

The experience does not constitute a sports, therapeutic, medical, or psychological activity, nor does it replace any professional treatment.

2. Voluntary participation

I participate freely and voluntarily, declaring that I am in adequate physical and emotional conditions to carry out the route.

At any time, I can stop, pause, or abandon the experience if I consider it necessary.

3. Responsibility during the route

I understand that I am responsible for my safety and my decisions throughout the entire experience.

I commit to:

    respecting traffic and coexistence rules;

    paying permanent attention to the surroundings;

    stopping the audio reproduction when the situation requires my full attention;

    respecting private property, cultural heritage, and the environment;

    not entering restricted or potentially dangerous places.

4. Risks

I understand that any walk or movement in public or natural spaces implies inherent risks, such as unevenness, vehicular traffic, irregular surfaces, weather conditions, presence of animals, or other unforeseen situations.

I assume said risks under my exclusive responsibility.

Sonora. Poetic Drift shall not be responsible for accidents, injuries, losses, thefts, material damages, or any other harm derived from actions, decisions, or circumstances occurring during the experience, except in those cases where applicable legislation expressly establishes otherwise.

5. Use of the application

The application and its contents are for personal use.

It is not permitted to:

    copy, reproduce, or distribute the audios, texts, or materials;

    modify the content;

    use the platform for commercial purposes without authorization;

    attempt to breach the functioning of the application.

6. Intellectual property

All routes, stories, texts, audios, music, images, design, visual identity, and other contents belong to Sonora. Poetic Drift or to their respective authors and are protected by current legislation on intellectual property.

Their use requires prior authorization, except for uses expressly permitted by law.

7. Privacy

The application may collect solely the data necessary for its operation and improvement, in accordance with its Privacy Policy.

Personal data will be treated confidentially and will not be shared with third parties, barring legal obligation or express authorization from the user.

8. Geolocation
The user authorizes this use solely for the functioning of the experience and may revoke this permission from their device settings.

9. Modifications

Sonora. Poetic Drift may update these terms when necessary. The modifications shall govern from their publication in the application.

10. Acceptance

By initiating an experience through the application, I confirm that I have read, understood, and accepted these terms and conditions, participating under my own responsibility.
`;

export const termsContentV2026_09_1 = termsContentV2026_09_1_ES;

export const baseTerms: readonly NewTermsVersion[] = [
  {
    version: '2026.09.1',
    lang: 'es',
    title: 'Términos y condiciones de participación',
    content: termsContentV2026_09_1_ES,
    contentHash: await sha256(termsContentV2026_09_1_ES),
    publishedAt: new Date('2026-09-13T00:00:00.000Z'),
  },
  {
    version: '2026.09.1',
    lang: 'en',
    title: 'Terms and Conditions of Use',
    content: termsContentV2026_09_1_EN,
    contentHash: await sha256(termsContentV2026_09_1_EN),
    publishedAt: new Date('2026-09-13T00:00:00.000Z'),
  },
];

export async function seedTerms(db: DbClient, terms: readonly NewTermsVersion[]): Promise<void> {
  logger.info('Seeding terms versions...');
  for (const term of terms) {
    await db
      .insert(termsVersionsTable)
      .values(term)
      .onConflictDoNothing({
        target: [termsVersionsTable.version, termsVersionsTable.lang],
      });
  }
}
