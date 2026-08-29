import type { Platform } from '@sonora/shared';
import { PAYMENT_ROUTES } from '@sonora/shared';
import { Hono } from 'hono';
import type { DbClient } from './db';
import { configureCors } from './middleware/cors';
import { injectDb } from './middleware/db-injector';
import { injectDeviceId } from './middleware/device-id';
import { customLogger } from './middleware/logger';
import { ERRORS, problem } from './middleware/problem-details';
import { associationRouter } from './routes/association';
import { appRedirectRouter } from './routes/app-redirect';
import { audioRouter } from './routes/audio';
import { configRouter } from './routes/config';
import { experiencesRouter } from './routes/experiences';
import { feedbackRouter } from './routes/feedback';
import { healthRouter } from './routes/health';
import { paymentsRouter } from './routes/payments';
import { themesRouter } from './routes/themes';
import { translationsRouter } from './routes/translations';

export interface Env {
  FEEDBACK_STORE?: KVNamespace;
  DATABASE_URL?: string;
  DB_ADAPTER?: 'neon';
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
  ALLOWED_METHODS?: string;
  ALLOWED_HEADERS?: string;
  PRIVATE_BUCKET?: R2Bucket;
  PUBLIC_BUCKET?: R2Bucket;
  ADMIN_API_KEY?: string;
  ADMIN_SESSION_COOKIE_SAMESITE?: 'Strict' | 'Lax' | 'None';
  ADMIN_SESSION_COOKIE_SECURE?: string;
  CLIENT_API_KEY?: string;
  JWT_SECRET?: string;
  AUDIO_LINK_EXPIRY_SECONDS?: string;
  MINIMUM_APP_VERSION: string;
  BLOCK_OLDER_VERSIONS: string;
  GRACE_PERIOD_START?: string;
  GRACE_PERIOD_END?: string;
  MP_ACCESS_TOKEN?: string;
  MP_WEBHOOK_SECRET?: string;
  DEFAULT_PAYMENT_PROVIDER?: string;
  ENABLE_API_LOGGING?: string;
  APP_SCHEME?: string;
  RATE_LIMIT_STORE?: KVNamespace;
  RATE_LIMITING_ENABLED?: string;
}

export interface Variables {
  db: DbClient;
  deviceId: string;
  devicePlatform: Platform;
  requestUrl: URL;
  privateBucket: R2Bucket;
  publicBucket: R2Bucket;
  jwtSecret: string;
  audioLinkExpirySeconds: number;
  configEnv: {
    minimumVersion: string;
    blockOlderVersions: boolean;
    gracePeriodStart?: string;
    gracePeriodEnd?: string;
  };
  environment: string;
  feedbackStore?: KVNamespace;
  paymentProviders: Record<string, import('./payments').PaymentProvider | null>;
  defaultPaymentProvider: 'mercadopago' | 'stripe' | 'paypal';
  appScheme: string;
}

// Re-export methods for test and server compatibility
export { setDbClient } from './middleware/db-injector';
export { isUniqueViolation } from './utils/db-errors';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mount Middlewares
app.use('*', customLogger());
app.use('*', configureCors());
app.use('*', injectDb());
app.use('*', injectDeviceId());

// Mount Routes
app.route('/health', healthRouter);
app.route('/feedback', feedbackRouter);
app.route('/themes', themesRouter);
app.route('/experiences', experiencesRouter);
app.route('/audio', audioRouter);
app.route('/config', configRouter);
app.route('/api/translations', translationsRouter);
app.route(PAYMENT_ROUTES.PREFIX, paymentsRouter);
app.route('/.well-known', associationRouter);
app.route('/app', appRedirectRouter);

// Global Error Handler
app.onError((err, c) => {
  return problem(c, ERRORS.INTERNAL, `Unhandled error: ${err.message}`);
});

export default app;
