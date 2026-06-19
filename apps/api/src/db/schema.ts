import { integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sonoraSchema = pgSchema('sonora');

export const tracks = sonoraSchema.table('tracks', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  audioUrl: text('audio_url').notNull(),
  feedbackTrigger: text('feedback_trigger'),
});

export const feedback = sonoraSchema.table('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  trackId: uuid('track_id')
    .notNull()
    .references(() => tracks.id),
  message: text('message').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
