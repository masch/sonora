import { Hono } from 'hono';
import { APP_IDENTIFIERS, PAYMENT_ROUTES } from '@sonora/shared';
import type { Env, Variables } from '../index';
import { success } from '../middleware/problem-details';

export const associationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /.well-known/apple-app-site-association
associationRouter.get('/apple-app-site-association', (c) => {
  return success(c, {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${APP_IDENTIFIERS.production.teamId}.${APP_IDENTIFIERS.production.appId}`,
          paths: [PAYMENT_ROUTES.CALLBACK, `${PAYMENT_ROUTES.PREFIX}/*`],
        },
        {
          appID: `${APP_IDENTIFIERS.staging.teamId}.${APP_IDENTIFIERS.staging.appId}`,
          paths: [PAYMENT_ROUTES.CALLBACK, `${PAYMENT_ROUTES.PREFIX}/*`],
        },
      ],
    },
  });
});

// GET /.well-known/assetlinks.json
associationRouter.get('/assetlinks.json', (c) => {
  return success(c, [
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
  ]);
});
