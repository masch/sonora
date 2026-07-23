import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { jwtGuard } from '../jwt-guard';
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
});
