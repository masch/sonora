import { APP_IDENTIFIERS } from '@sonora/shared';
import { Hono } from 'hono';
import QRCode from 'qrcode';
import { SONORA_LOGO_BASE64 } from '../assets/logo-base64';
import type { Env, Variables } from '../index';

export const appRedirectRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_IDENTIFIERS.production.appId}`;
const WEB_APP_URL = 'https://sonoraderivapoeticas-team-sonora.expo.app/';

// GET /app -> Smart Redirect
appRedirectRouter.get('/', (c) => {
  const userAgent = c.req.header('user-agent') || '';
  const isAndroid = /android/i.test(userAgent);
  const targetUrl = isAndroid ? PLAY_STORE_URL : WEB_APP_URL;

  return c.redirect(targetUrl, 302);
});

// GET /app/qr -> QR code generator & visual preview
appRedirectRouter.get('/qr', async (c) => {
  const format = c.req.query('format');
  const targetParam = c.req.query('target');
  const sizeParam = parseInt(c.req.query('size') || '1024', 10);
  const exportSize = Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : 1024;

  let redirectUrl = 'https://sonora-api.sonora-api.workers.dev/app';
  if (targetParam === 'local') {
    redirectUrl = new URL('/app', c.req.url).toString();
  } else if (targetParam?.startsWith('http')) {
    redirectUrl = targetParam;
  } else {
    const currentUrl = new URL(c.req.url);
    if (!currentUrl.hostname.includes('localhost') && !currentUrl.hostname.includes('127.0.0.1')) {
      redirectUrl = new URL('/app', c.req.url).toString();
    }
  }

  const rawSvg = await QRCode.toString(redirectUrl, {
    type: 'svg',
    width: exportSize,
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });

  const viewBoxMatch = rawSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const size = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : 49;
  const center = size / 2;
  const logoRadius = size * 0.125;

  const logoOverlay = `
  <defs>
    <clipPath id="logo-circle-clip">
      <circle cx="${center}" cy="${center}" r="${logoRadius}" />
    </clipPath>
  </defs>
  <circle cx="${center}" cy="${center}" r="${logoRadius + 0.8}" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.3" />
  <image x="${center - logoRadius}" y="${center - logoRadius}" width="${logoRadius * 2}" height="${logoRadius * 2}" href="${SONORA_LOGO_BASE64}" clip-path="url(#logo-circle-clip)" preserveAspectRatio="xMidYMid slice" />
`;

  const svg = rawSvg.replace('</svg>', `${logoOverlay}</svg>`);

  if (format === 'svg' || c.req.header('accept')?.includes('image/svg+xml')) {
    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="sonora-qr-${exportSize}x${exportSize}.svg"`,
      'Cache-Control': 'public, max-age=86400',
    });
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sonora - App QR</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background-color: var(--card);
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      border: 1px solid #334155;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 8px;
      font-weight: 700;
    }
    p.desc {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 24px;
      line-height: 1.4;
    }
    .qr-box {
      background: white;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 20px;
      max-width: 100%;
    }
    .qr-box svg {
      display: block;
      width: 240px;
      height: 240px;
      max-width: 100%;
      height: auto;
    }
    .links {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
    }
    .btn {
      display: inline-block;
      background-color: var(--accent);
      color: #0f172a;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      padding: 10px 16px;
      border-radius: 8px;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: var(--accent-hover);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sonora</h1>
    <p class="desc">Escanear para navegar a la deriva poética</p>
    <div class="qr-box">
      ${svg}
    </div>
    <div class="links">
      <a class="btn" href="/app/qr?format=svg&size=1024" download="sonora-qr.svg">Descargar QR</a>
    </div>
  </div>
</body>
</html>`;

  return c.html(html, 200, {
    'Cache-Control': 'public, max-age=3600',
  });
});
