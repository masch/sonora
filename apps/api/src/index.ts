import type { MapRenderer, Platform } from '@sonora/shared';
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
import { leadsRouter } from './routes/leads';
import { paymentsRouter } from './routes/payments';
import { themesRouter } from './routes/themes';
import { termsRouter } from './routes/terms';
import { mapDocumentsRouter } from './routes/map-documents';
import { mediaRouter } from './routes/media';
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
  /**
   * Version of the published map artifacts. Defaults to
   * `DEFAULT_MAP_ARTIFACT_VERSION`; the archive and style urls are derived from
   * it, so no url is configured here.
   */
  MAP_ARTIFACT_VERSION?: string;
  /**
   * Comma-separated regions the app prefetches at startup. Defaults to
   * `DEFAULT_MAP_REGION`; a region the public bucket does not hold is dropped
   * from the payload instead of being handed to a client.
   */
  MAP_PRELOAD_REGIONS?: string;
  /** `maplibre` enables the new renderer; anything else stays on Leaflet. */
  MAP_RENDERER?: string;
  /**
   * Comma-separated platforms that can render the new map. Public config, not a
   * secret: it is declared in `wrangler.toml`, and `web` is left out until the
   * web export emits the MapLibre worker.
   */
  MAP_RENDERER_PLATFORMS?: string;
  /**
   * Comma-separated device ids forced onto MapLibre. A **secret**: set it with
   * `wrangler secret` (never in `wrangler.toml`, the repository is public).
   */
  MAP_RENDERER_DEVICE_IDS?: string;
  /**
   * Comma-separated device ids forced back onto Leaflet, ahead of the
   * allowlist. A **secret**, set the same way as `MAP_RENDERER_DEVICE_IDS`.
   */
  MAP_RENDERER_DEVICE_IDS_BLOCKED?: string;
  /**
   * `true` lets `/config` publish `map.layers`. Off unless set: every build
   * released before the tolerant `MapConfigSchema` rejects the whole `map`
   * object over that one key, so the field travels only where the builds that
   * receive it parse it.
   */
  MAP_LAYERS_WIRE?: string;
  /**
   * `true` offers the layer selector to the walker. A misspelled or unset value
   * keeps it off, which is the compiled default.
   */
  MAP_LAYERS_SHOW_CONTROL?: string;
  /**
   * Comma-separated layer groups the selector offers, in render order, with a
   * leading dash for "hidden until asked" (`roads,-buildings`). Ids this build
   * does not implement are dropped.
   */
  MAP_LAYERS_GROUPS?: string;
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
  BYPASS_GEOFENCE_IOS_BROWSER?: string;
  MP_ACCESS_TOKEN?: string;
  MP_WEBHOOK_SECRET?: string;
  DEFAULT_PAYMENT_PROVIDER?: string;
  HMAC_SECRET?: string;
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
  hmacSecret: string;
  audioLinkExpirySeconds: number;
  configEnv: {
    minimumVersion: string;
    blockOlderVersions: boolean;
    gracePeriodStart?: string;
    gracePeriodEnd?: string;
    bypassIosBrowser: boolean;
    /** Version the archive and style urls are derived from. */
    mapArtifactVersion: string;
    /**
     * Regions the app prefetches at startup, normalized: only names this build
     * knows, deduped, and the documented default when the variable is unset.
     */
    mapPreloadRegions: readonly import('@sonora/shared').MapRegionKey[];
    /**
     * Normalized renderer, never the raw variable: `maplibre` only for that
     * exact value, `leaflet` for anything else including unset.
     */
    mapRenderer: MapRenderer;
    /**
     * Normalized capability list: only these platforms can render `maplibre`.
     * Defaults to `android` and `ios` when the variable is unset, so a browser
     * never receives a renderer it cannot mount.
     */
    mapRendererPlatforms: readonly string[];
    /** Normalized `MAP_RENDERER_DEVICE_IDS`; empty when the variable is unset. */
    mapRendererDeviceIds: readonly string[];
    /**
     * Normalized `MAP_RENDERER_DEVICE_IDS_BLOCKED`; empty when the variable is
     * unset. Checked before the allowlist.
     */
    mapRendererDeviceIdsBlocked: readonly string[];
    /**
     * Whether `map.layers` may travel at all. Off unless the environment says
     * `true`, because the field is only parseable by the builds released with
     * the tolerant schema.
     */
    mapLayersWire: boolean;
    /** Whether the served selector is offered to the walker. */
    mapLayerShowControl: boolean;
    /**
     * Normalized `MAP_LAYERS_GROUPS`: the groups to offer, in render order, each
     * with the state it opens in. Only ids this build implements.
     */
    mapLayerGroups: readonly import('./lib/map-layers').ServedLayerGroup[];
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
app.route('/leads', leadsRouter);
app.route('/themes', themesRouter);
app.route('/experiences', experiencesRouter);
app.route('/audio', audioRouter);
app.route('/config', configRouter);
app.route('/terms', termsRouter);
app.route('/map-documents', mapDocumentsRouter);
app.route('/media', mediaRouter);
app.route('/translations', translationsRouter);
// Backward compatibility alias for existing mobile apps
app.route('/api/translations', translationsRouter);
app.route(PAYMENT_ROUTES.PREFIX, paymentsRouter);
app.route('/.well-known', associationRouter);
app.route('/app', appRedirectRouter);

// Global Error Handler
app.onError((err, c) => {
  return problem(c, ERRORS.INTERNAL, `Unhandled error: ${err.message}`);
});

export default app;
