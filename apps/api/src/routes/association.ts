import { Hono } from 'hono';
import { APP_IDENTIFIERS } from '@sonora/shared';
import type { Env, Variables } from '../index';

export const associationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /.well-known/apple-app-site-association
associationRouter.get('/apple-app-site-association', (c) => {
  return c.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${APP_IDENTIFIERS.production.teamId}.${APP_IDENTIFIERS.production.appId}`,
            paths: ['/payment/callback', '/payment/*'],
          },
          {
            appID: `${APP_IDENTIFIERS.staging.teamId}.${APP_IDENTIFIERS.staging.appId}`,
            paths: ['/payment/callback', '/payment/*'],
          },
        ],
      },
    },
    200,
    { 'Content-Type': 'application/json' },
  );
});

// GET /.well-known/assetlinks.json
associationRouter.get('/assetlinks.json', (c) => {
  return c.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: APP_IDENTIFIERS.production.appId,
          sha256_cert_fingerprints: APP_IDENTIFIERS.production.sha256CertFingerprints,
        },
      },
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: APP_IDENTIFIERS.staging.appId,
          sha256_cert_fingerprints: APP_IDENTIFIERS.staging.sha256CertFingerprints,
        },
      },
    ],
    200,
    { 'Content-Type': 'application/json' },
  );
});
