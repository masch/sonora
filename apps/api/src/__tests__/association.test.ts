import { describe, it, expect } from 'vitest';
import { APP_IDENTIFIERS } from '@sonora/shared';
import app from '../index';

describe('GET /.well-known/apple-app-site-association', () => {
  it('returns AASA JSON for staging environment', async () => {
    const bindings = { ENVIRONMENT: 'staging' };
    const res = await app.request('/.well-known/apple-app-site-association', {}, bindings);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);

    const body = (await res.json()) as Record<string, any>;
    expect(body).toHaveProperty('applinks');
    expect(body.applinks).toHaveProperty('details');
    expect(body.applinks.details).toHaveLength(2);
    expect(body.applinks.details[0].appID).toBe(
      `${APP_IDENTIFIERS.production.teamId}.${APP_IDENTIFIERS.production.appId}`,
    );
    expect(body.applinks.details[1].appID).toBe(
      `${APP_IDENTIFIERS.staging.teamId}.${APP_IDENTIFIERS.staging.appId}`,
    );
  });

  it('returns AASA JSON for production environment', async () => {
    const bindings = { ENVIRONMENT: 'production' };
    const res = await app.request('/.well-known/apple-app-site-association', {}, bindings);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.applinks.details[0].appID).toBe(
      `${APP_IDENTIFIERS.production.teamId}.${APP_IDENTIFIERS.production.appId}`,
    );
  });
});

describe('GET /.well-known/assetlinks.json', () => {
  it('returns Android assetlinks JSON array', async () => {
    const res = await app.request('/.well-known/assetlinks.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);

    const body = (await res.json()) as Array<Record<string, any>>;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].target.package_name).toBe(APP_IDENTIFIERS.production.appId);
    expect(body[1].target.package_name).toBe(APP_IDENTIFIERS.staging.appId);
    expect(body[0].target.sha256_cert_fingerprints[0]).toBe(
      APP_IDENTIFIERS.production.sha256CertFingerprints[0],
    );
  });
});
