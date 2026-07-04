import {
  boolean,
  doublePrecision,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const sonoraSchema = pgSchema('sonora');

export const experienceFormatEnum = sonoraSchema.enum('experience_format', [
  'track',
  'trip',
  'general-feedback',
]);

export const themes = sonoraSchema.table('themes', {
  key: text('key').primaryKey(),
  labelKey: text('label_key').notNull(),
  order: integer('order').notNull(),
  applicableFormat: experienceFormatEnum('applicable_format'),
});

export const experiences = sonoraSchema.table('experiences', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  format: experienceFormatEnum('format').notNull(),
  themeKey: text('theme_key')
    .notNull()
    .references(() => themes.key),
  audioUrl: text('audio_url'),
  durationSeconds: integer('duration_seconds').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }),
  priceLabel: text('price_label'),
  imageKey: text('image_key').notNull(),
  geofenceBypassable: boolean('geofence_bypassable').default(false).notNull(),
});

export const waypoints = sonoraSchema.table('waypoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  experienceId: uuid('experience_id')
    .notNull()
    .references(() => experiences.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  audioUrl: text('audio_url'),
  radiusMeters: integer('radius_meters').default(50).notNull(),
});

export const feedback = sonoraSchema.table('feedbacks', {
  id: uuid('id').defaultRandom().primaryKey(),
  experienceId: uuid('experience_id')
    .notNull()
    .references(() => experiences.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
});

export const translations = sonoraSchema.table(
  'translations',
  {
    lang: text('lang').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.lang, table.key] }),
  }),
);

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
export type Experience = typeof experiences.$inferSelect;
export type NewExperience = typeof experiences.$inferInsert;
export type Waypoint = typeof waypoints.$inferSelect;
export type NewWaypoint = typeof waypoints.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;
