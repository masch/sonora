import { describe, it, expect } from 'vitest';
import { APP_IDENTIFIERS } from '@sonora/shared';
import app from '../index';

describe('GET /app (Smart Redirect)', () => {
  it('redirects to Google Play Store when User-Agent is Android', async () => {
    const res = await app.request('/app', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(
      `https://play.google.com/store/apps/details?id=${APP_IDENTIFIERS.production.appId}`,
    );
  });

  it('redirects to Web app when User-Agent is iOS or desktop', async () => {
    const res = await app.request('/app', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://sonoraderivapoeticas-team-sonora.expo.app/');
  });

  it('redirects to Web app by default when User-Agent is missing', async () => {
    const res = await app.request('/app');

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://sonoraderivapoeticas-team-sonora.expo.app/');
  });
});

describe('GET /app/qr (QR Code Generation)', () => {
  it('returns HTML view containing QR SVG by default', async () => {
    const res = await app.request('/app/qr');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const text = await res.text();
    expect(text).toContain('<svg');
    expect(text).toContain('Sonora - App QR');
  });

  it('returns raw SVG image when format=svg query param is passed', async () => {
    const res = await app.request('/app/qr?format=svg');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    const text = await res.text();
    expect(text).toContain('<svg');
  });
});
