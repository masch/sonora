import { integer, pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const sonoraSchema = pgSchema('sonora');

export const trips = sonoraSchema.table('trips', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  audioUrl: text('audio_url').notNull(),
  feedbackTrigger: text('feedback_trigger'),
});

export const feedback = sonoraSchema.table('feedback', {
  id: serial('id').primaryKey(),
  tripId: text('trip_id')
    .notNull()
    .references(() => trips.id),
  message: text('message').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
