import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  SUPPORTED_LANGUAGES,
  PAYMENT_PROVIDERS,
  CURRENCIES,
  ACCESS_SOURCES,
  PURCHASE_STATUSES,
  PLATFORMS,
  EXPERIENCE_FORMATS,
} from '@sonora/shared';

export const sonoraSchema = pgSchema('sonora');

export const experienceFormatEnum = sonoraSchema.enum('experience_format', [...EXPERIENCE_FORMATS]);

export const paymentProviderEnum = sonoraSchema.enum('payment_provider', [...PAYMENT_PROVIDERS]);

export const accessSourceEnum = sonoraSchema.enum('access_source', [...ACCESS_SOURCES]);
export const purchaseStatusEnum = sonoraSchema.enum('purchase_status', [...PURCHASE_STATUSES]);

export const platformEnum = sonoraSchema.enum('platform', [...PLATFORMS]);

export const currencyEnum = sonoraSchema.enum('currency', [...CURRENCIES]);

export const languageEnum = sonoraSchema.enum('language', [...SUPPORTED_LANGUAGES]);

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
  free: boolean('free').notNull().default(true),
  price: integer('price'),
  currency: currencyEnum('currency').default('ARS'),
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

export const purchases = sonoraSchema.table('purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email'),
  experienceId: uuid('experience_id')
    .notNull()
    .references(() => experiences.id, { onDelete: 'cascade' }),
  provider: paymentProviderEnum('provider').notNull(),
  providerPaymentId: text('provider_payment_id').notNull().unique(),
  status: purchaseStatusEnum('status').notNull().default('pending'),
  amount: integer('amount').notNull(),
  currency: currencyEnum('currency').notNull().default('ARS'),
  metadata: jsonb('metadata'),
  deviceId: text('device_id').notNull(),
  platform: platformEnum('platform').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const experienceAccesses = sonoraSchema.table('experience_accesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  experienceId: uuid('experience_id')
    .notNull()
    .references(() => experiences.id, { onDelete: 'cascade' }),
  email: text('email'),
  deviceId: text('device_id').notNull(),
  source: accessSourceEnum('source').notNull(),
  priceAtAccess: integer('price_at_access'),
  platform: platformEnum('platform'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
    lang: languageEnum('lang').notNull(),
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
export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
export type ExperienceAccess = typeof experienceAccesses.$inferSelect;
export type NewExperienceAccess = typeof experienceAccesses.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;
