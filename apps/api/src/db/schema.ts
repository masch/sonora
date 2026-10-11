import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  ACCESS_SOURCES,
  CURRENCIES,
  EXPERIENCE_FORMATS,
  GEO_MODES,
  LEAD_SOURCES,
  PAYMENT_PROVIDERS,
  PLATFORMS,
  PURCHASE_STATUSES,
  SUPPORTED_LANGUAGES,
  type ExperienceCredit,
} from '@sonora/shared';

export const sonoraSchema = pgSchema('sonora');

export const experienceFormatEnum = sonoraSchema.enum('experience_format', [...EXPERIENCE_FORMATS]);

export const experienceGeoModeEnum = sonoraSchema.enum('geo_mode', [...GEO_MODES]);

export const paymentProviderEnum = sonoraSchema.enum('payment_provider', [...PAYMENT_PROVIDERS]);

export const accessSourceEnum = sonoraSchema.enum('access_source', [...ACCESS_SOURCES]);
export const purchaseStatusEnum = sonoraSchema.enum('purchase_status', [...PURCHASE_STATUSES]);

export const platformEnum = sonoraSchema.enum('platform', [...PLATFORMS]);

export const currencyEnum = sonoraSchema.enum('currency', [...CURRENCIES]);

export const languageEnum = sonoraSchema.enum('language', [...SUPPORTED_LANGUAGES]);

export const leadSourceEnum = sonoraSchema.enum('lead_source', [...LEAD_SOURCES]);

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
  geoMode: experienceGeoModeEnum('geo_mode').notNull(),
  radiusMeters: integer('radius_meters'),
  published: boolean('published').notNull(),
  credits: jsonb('credits').$type<ExperienceCredit[]>(),
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

export const freeDownloads = sonoraSchema.table('free_downloads', {
  id: uuid('id').defaultRandom().primaryKey(),
  experienceId: uuid('experience_id')
    .notNull()
    .references(() => experiences.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  deviceId: text('device_id').notNull(),
  platform: platformEnum('platform'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leads = sonoraSchema.table('leads', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  experienceId: uuid('experience_id').references(() => experiences.id, { onDelete: 'cascade' }),
  source: leadSourceEnum('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const experienceCoupons = sonoraSchema.table(
  'experience_coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    experienceId: uuid('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    emailHash: text('email_hash').notNull(),
    emailMasked: text('email_masked').notNull(),
    notes: text('notes').notNull(),
    maxDownloads: integer('max_downloads').notNull().default(1),
    usedDownloads: integer('used_downloads').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('experience_coupons_experience_id_email_hash_unique').on(
      table.experienceId,
      table.emailHash,
    ),
  ],
);

export const experienceCouponRedemptions = sonoraSchema.table(
  'experience_coupon_redemptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => experienceCoupons.id, { onDelete: 'cascade' }),
    experienceId: uuid('experience_id')
      .notNull()
      .references(() => experiences.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    platform: platformEnum('platform').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('experience_coupon_redemptions_coupon_id_device_id_unique').on(
      table.couponId,
      table.deviceId,
    ),
  ],
);

export const translations = sonoraSchema.table(
  'translations',
  {
    lang: languageEnum('lang').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.lang, table.key] })],
);

export const termsVersions = sonoraSchema.table(
  'terms_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    version: text('version').notNull(),
    lang: languageEnum('lang').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  },
  (table) => [unique().on(table.version, table.lang)],
);

export const termsAcceptances = sonoraSchema.table('terms_acceptances', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: text('device_id').notNull(),
  version: text('version').notNull(),
  lang: languageEnum('lang').notNull(),
  contentHash: text('content_hash').notNull(),
  platform: platformEnum('platform').notNull(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent').notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
});

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
export type FreeDownload = typeof freeDownloads.$inferSelect;
export type NewFreeDownload = typeof freeDownloads.$inferInsert;
export type ExperienceCoupon = typeof experienceCoupons.$inferSelect;
export type NewExperienceCoupon = typeof experienceCoupons.$inferInsert;
export type ExperienceCouponRedemption = typeof experienceCouponRedemptions.$inferSelect;
export type NewExperienceCouponRedemption = typeof experienceCouponRedemptions.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;
export type TermsVersion = typeof termsVersions.$inferSelect;
export type NewTermsVersion = typeof termsVersions.$inferInsert;
export type TermsAcceptance = typeof termsAcceptances.$inferSelect;
export type NewTermsAcceptance = typeof termsAcceptances.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
