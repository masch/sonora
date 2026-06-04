import { pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const sonoraSchema = pgSchema('sonora');

export const feedback = sonoraSchema.table('feedback', {
  id: serial('id').primaryKey(),
  tripId: text('trip_id').notNull(),
  message: text('message').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
