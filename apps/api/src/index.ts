import { Hono } from 'hono';
import { type DbClient } from './db';
import { configureCors } from './middleware/cors';
import { injectDb } from './middleware/db-injector';
import { feedbackRouter, type FeedbackResponse } from './routes/feedback';
import { healthRouter } from './routes/health';
import { themesRouter } from './routes/themes';
import { experiencesRouter } from './routes/experiences';

export interface Env {
  FEEDBACK_STORE?: KVNamespace;
  FEEDBACK_MAX_LENGTH?: string;
  DATABASE_URL?: string;
  DB_ADAPTER?: 'neon';
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
  ALLOWED_METHODS?: string;
  ALLOWED_HEADERS?: string;
}

export interface Variables {
  db?: DbClient;
}

// Re-export methods for test and server compatibility
export { setDbClient } from './middleware/db-injector';
export { isUniqueViolation } from './utils/db-errors';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mount Middlewares
app.use('*', configureCors());
app.use('*', injectDb());

// Mount Routes
app.route('/health', healthRouter);
app.route('/feedback', feedbackRouter);
app.route('/themes', themesRouter);
app.route('/experiences', experiencesRouter);

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json<FeedbackResponse>({ status: 'error', errors: ['Internal server error'] }, 500);
});

export default app;
