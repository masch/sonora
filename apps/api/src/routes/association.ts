import { Hono } from 'hono';
import type { Env, Variables } from '../index';

export const associationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /.well-known/apple-app-site-association
associationRouter.get('/apple-app-site-association', (c) => {
  const teamId = c.env.ENVIRONMENT === 'production' ? '6C5EC74CE4' : '6C5EC74CE4'; // Replace with Apple Team ID if different

  return c.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.com.masch.sonora`,
            paths: ['/payment/callback', '/payment/*'],
          },
          {
            appID: `${teamId}.com.masch.sonora.staging`,
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
  // Replace fingerprint with actual release/debug SHA-256 keys
  const fingerprint =
    '14:6D:E9:83:C5:EC:74:CE:4A:73:6B:6A:A2:DE:9D:74:25:A3:A1:79:F6:07:52:8A:3A:17:9F:60:75:28:B5:69';

  return c.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.masch.sonora',
          sha256_cert_fingerprints: [fingerprint],
        },
      },
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.masch.sonora.staging',
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
    200,
    { 'Content-Type': 'application/json' },
  );
});
