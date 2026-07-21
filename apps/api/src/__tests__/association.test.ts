import { describe, it, expect } from 'vitest';
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
    expect(body.applinks.details[0].appID).toBe('6C5EC74CE4.com.masch.sonora');
    expect(body.applinks.details[1].appID).toBe('6C5EC74CE4.com.masch.sonora.staging');
  });

  it('returns AASA JSON for production environment', async () => {
    const bindings = { ENVIRONMENT: 'production' };
    const res = await app.request('/.well-known/apple-app-site-association', {}, bindings);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.applinks.details[0].appID).toBe('6C5EC74CE4.com.masch.sonora');
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
    expect(body[0].target.package_name).toBe('com.masch.sonora');
    expect(body[1].target.package_name).toBe('com.masch.sonora.staging');
    expect(body[0].target.sha256_cert_fingerprints[0]).toBe(
      '14:6D:E9:83:C5:EC:74:CE:4A:73:6B:6A:A2:DE:9D:74:25:A3:A1:79:F6:07:52:8A:3A:17:9F:60:75:28:B5:69',
    );
  });
});
