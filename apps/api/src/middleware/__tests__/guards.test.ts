import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { DEFAULT_MAP_ARTIFACT_VERSION, DEFAULT_MAP_REGION } from '@sonora/shared';
import { jwtGuard } from '../jwt-guard';
import { hmacGuard } from '../hmac-guard';
import { configGuard } from '../config-guard';
import { paymentsGuard } from '../payments-guard';
import { envGuard } from '../env-guard';
import type { Env, Variables } from '../../index';

describe('Middleware Guards (c.var injection)', () => {
  describe('jwtGuard', () => {
    it('returns 500 JWT_SECRET_MISSING when JWT_SECRET is not set', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', jwtGuard(), (c) => c.text('ok'));

      const res = await app.request('/test', {}, {});
      expect(res.status).toBe(500);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('JWT_SECRET_MISSING');
    });

    it('injects jwtSecret and audioLinkExpirySeconds into c.var when present', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', jwtGuard(), (c) => {
        return c.json({
          jwtSecret: c.var.jwtSecret,
          expiry: c.var.audioLinkExpirySeconds,
        });
      });

      const res = await app.request(
        '/test',
        {},
        { JWT_SECRET: 'my-secret', AUDIO_LINK_EXPIRY_SECONDS: '1200' },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { jwtSecret: string; expiry: number };
      expect(body.jwtSecret).toBe('my-secret');
      expect(body.expiry).toBe(1200);
    });
  });

  describe('configGuard', () => {
    it('injects configEnv into c.var', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', configGuard(), (c) => c.json(c.var.configEnv));

      const res = await app.request(
        '/test',
        {},
        {
          MINIMUM_APP_VERSION: '1.2.0',
          BLOCK_OLDER_VERSIONS: 'true',
          GRACE_PERIOD_START: '2026-01-01',
          GRACE_PERIOD_END: '2026-02-01',
        },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.minimumVersion).toBe('1.2.0');
      expect(body.blockOlderVersions).toBe(true);
      expect(body.gracePeriodStart).toBe('2026-01-01');
      expect(body.gracePeriodEnd).toBe('2026-02-01');
    });

    it('normalizes MAP_ARTIFACT_VERSION into configEnv', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', configGuard(), (c) => c.json(c.var.configEnv));

      const configured = await app.request(
        '/test',
        {},
        {
          MINIMUM_APP_VERSION: '1.0.0',
          BLOCK_OLDER_VERSIONS: 'false',
          MAP_ARTIFACT_VERSION: ' v7 ',
        },
      );
      const configuredBody = (await configured.json()) as { mapArtifactVersion: string };
      expect(configuredBody.mapArtifactVersion).toBe('v7');

      // An unset or unusable version is the compiled one: the version is a path
      // segment in the bucket key, so anything that could escape it is dropped.
      for (const value of [undefined, '', '   ', 'v7/../../private', '../v7', 'v7 pmtiles']) {
        const res = await app.request(
          '/test',
          {},
          {
            MINIMUM_APP_VERSION: '1.0.0',
            BLOCK_OLDER_VERSIONS: 'false',
            MAP_ARTIFACT_VERSION: value,
          },
        );
        const body = (await res.json()) as { mapArtifactVersion: string };
        expect({ value, version: body.mapArtifactVersion }).toEqual({
          value,
          version: DEFAULT_MAP_ARTIFACT_VERSION,
        });
      }
    });

    it('normalizes MAP_PRELOAD_REGIONS into configEnv', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', configGuard(), (c) => c.json(c.var.configEnv));

      const configured = await app.request(
        '/test',
        {},
        {
          MINIMUM_APP_VERSION: '1.0.0',
          BLOCK_OLDER_VERSIONS: 'false',
          MAP_PRELOAD_REGIONS: ' calamuchita ,,, calamuchita ',
        },
      );
      const configuredBody = (await configured.json()) as { mapPreloadRegions: string[] };
      expect(configuredBody.mapPreloadRegions).toEqual(['calamuchita']);

      // A name that is not a region cannot be preloaded, and guessing a region
      // the operator did not ask for would be worse than preloading nothing.
      const unknown = await app.request(
        '/test',
        {},
        {
          MINIMUM_APP_VERSION: '1.0.0',
          BLOCK_OLDER_VERSIONS: 'false',
          MAP_PRELOAD_REGIONS: 'otro-valle',
        },
      );
      const unknownBody = (await unknown.json()) as { mapPreloadRegions: string[] };
      expect(unknownBody.mapPreloadRegions).toEqual([]);

      // Unset is the documented default: the region this build knows about.
      const unset = await app.request(
        '/test',
        {},
        { MINIMUM_APP_VERSION: '1.0.0', BLOCK_OLDER_VERSIONS: 'false' },
      );
      const unsetBody = (await unset.json()) as { mapPreloadRegions: string[] };
      expect(unsetBody.mapPreloadRegions).toEqual([DEFAULT_MAP_REGION]);
    });

    it('normalizes MAP_RENDERER into configEnv', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', configGuard(), (c) => c.json(c.var.configEnv));

      const enabled = await app.request(
        '/test',
        {},
        { MINIMUM_APP_VERSION: '1.0.0', BLOCK_OLDER_VERSIONS: 'false', MAP_RENDERER: 'maplibre' },
      );
      const enabledBody = (await enabled.json()) as { mapRenderer: string };
      expect(enabledBody.mapRenderer).toBe('maplibre');

      // Only the exact value enables the new renderer; anything else is the
      // historical map, so an unknown value never reaches a client.
      for (const value of ['', 'leaflet', 'MapLibre', 'maplibre ', 'webgl']) {
        const res = await app.request(
          '/test',
          {},
          { MINIMUM_APP_VERSION: '1.0.0', BLOCK_OLDER_VERSIONS: 'false', MAP_RENDERER: value },
        );
        const body = (await res.json()) as { mapRenderer: string };
        expect({ value, renderer: body.mapRenderer }).toEqual({ value, renderer: 'leaflet' });
      }

      const unset = await app.request(
        '/test',
        {},
        { MINIMUM_APP_VERSION: '1.0.0', BLOCK_OLDER_VERSIONS: 'false' },
      );
      const unsetBody = (await unset.json()) as { mapRenderer: string };
      expect(unsetBody.mapRenderer).toBe('leaflet');
    });

    it('normalizes MAP_RENDERER_PLATFORMS into configEnv', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', configGuard(), (c) => c.json(c.var.configEnv));

      const configured = await app.request(
        '/test',
        {},
        {
          MINIMUM_APP_VERSION: '1.0.0',
          BLOCK_OLDER_VERSIONS: 'false',
          MAP_RENDERER_PLATFORMS: ' Android , ios ,, android , Web ',
        },
      );
      const configuredBody = (await configured.json()) as { mapRendererPlatforms: string[] };
      expect(configuredBody.mapRendererPlatforms).toEqual(['android', 'ios', 'web']);

      // An unset variable is not "every platform is capable": it is the default
      // list, which leaves web out because the web build cannot mount the
      // MapLibre worker yet.
      const unset = await app.request(
        '/test',
        {},
        { MINIMUM_APP_VERSION: '1.0.0', BLOCK_OLDER_VERSIONS: 'false' },
      );
      const unsetBody = (await unset.json()) as { mapRendererPlatforms: string[] };
      expect(unsetBody.mapRendererPlatforms).toEqual(['android', 'ios']);
    });

    it('normalizes the per-device renderer lists into configEnv', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', configGuard(), (c) => c.json(c.var.configEnv));

      const configured = await app.request(
        '/test',
        {},
        {
          MINIMUM_APP_VERSION: '1.0.0',
          BLOCK_OLDER_VERSIONS: 'false',
          MAP_RENDERER_DEVICE_IDS: ' hash-a , hash-b ,, hash-a ,',
          MAP_RENDERER_DEVICE_IDS_BLOCKED: ' hash-c,hash-d, hash-c ',
        },
      );
      const configuredBody = (await configured.json()) as {
        mapRendererDeviceIds: string[];
        mapRendererDeviceIdsBlocked: string[];
      };
      expect(configuredBody.mapRendererDeviceIds).toEqual(['hash-a', 'hash-b']);
      expect(configuredBody.mapRendererDeviceIdsBlocked).toEqual(['hash-c', 'hash-d']);

      const unset = await app.request(
        '/test',
        {},
        { MINIMUM_APP_VERSION: '1.0.0', BLOCK_OLDER_VERSIONS: 'false' },
      );
      const unsetBody = (await unset.json()) as {
        mapRendererDeviceIds: string[];
        mapRendererDeviceIdsBlocked: string[];
      };
      expect(unsetBody.mapRendererDeviceIds).toEqual([]);
      expect(unsetBody.mapRendererDeviceIdsBlocked).toEqual([]);
    });
  });

  describe('paymentsGuard', () => {
    it('injects paymentProviders, defaultPaymentProvider, and appScheme into c.var', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', paymentsGuard(), (c) => {
        return c.json({
          defaultProvider: c.var.defaultPaymentProvider,
          hasProviders: !!c.var.paymentProviders,
          appScheme: c.var.appScheme,
        });
      });

      const res = await app.request(
        '/test',
        {},
        {
          DEFAULT_PAYMENT_PROVIDER: 'stripe',
          MP_ACCESS_TOKEN: 'test-mp-token',
          MP_WEBHOOK_SECRET: 'test-secret',
        },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        defaultProvider: string;
        hasProviders: boolean;
        appScheme: string;
      };
      expect(body.defaultProvider).toBe('stripe');
      expect(body.hasProviders).toBe(true);
      expect(body.appScheme).toBe('sonora');
    });

    it('resolves appScheme to sonora-staging when ENVIRONMENT is staging', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', paymentsGuard(), (c) => c.json({ appScheme: c.var.appScheme }));

      const res = await app.request(
        '/test',
        {},
        { ENVIRONMENT: 'staging', MP_ACCESS_TOKEN: 'token', MP_WEBHOOK_SECRET: 'secret' },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { appScheme: string };
      expect(body.appScheme).toBe('sonora-staging');
    });

    it('allows explicit APP_SCHEME environment variable override', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', paymentsGuard(), (c) => c.json({ appScheme: c.var.appScheme }));

      const res = await app.request(
        '/test',
        {},
        { APP_SCHEME: 'custom-scheme', MP_ACCESS_TOKEN: 'token', MP_WEBHOOK_SECRET: 'secret' },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { appScheme: string };
      expect(body.appScheme).toBe('custom-scheme');
    });
  });

  describe('envGuard', () => {
    it('injects environment and feedbackStore into c.var', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', envGuard(), (c) => {
        return c.json({
          environment: c.var.environment,
          hasStore: c.var.feedbackStore !== undefined,
        });
      });

      const res = await app.request('/test', {}, { ENVIRONMENT: 'production' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { environment: string; hasStore: boolean };
      expect(body.environment).toBe('production');
      expect(body.hasStore).toBe(false);
    });
  });

  describe('hmacGuard', () => {
    it('returns 500 HMAC_SECRET_MISSING when HMAC_SECRET is not set', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', hmacGuard(), (c) => c.text('ok'));

      const res = await app.request('/test', {}, {});
      expect(res.status).toBe(500);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('HMAC_SECRET_MISSING');
    });

    it('injects hmacSecret into c.var when present', async () => {
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.get('/test', hmacGuard(), (c) => {
        return c.json({
          hmacSecret: c.var.hmacSecret,
        });
      });

      const res = await app.request('/test', {}, { HMAC_SECRET: 'my-hmac-salt' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { hmacSecret: string };
      expect(body.hmacSecret).toBe('my-hmac-salt');
    });
  });
});
