# Design - Fix Mercado Pago Return Redirect & Pluralize Payment Routes

## Architecture & Logic Changes

### 1. Gateway Domain Referer Filtering (`apps/api/src/routes/payments.ts`)

- Update `GET /payments/return/:status/:purchaseId` handler:
  1. Check `purchase.metadata.redirectUrl`. If present, issue HTTP 302 redirect.
  2. Inspect `Referer` header. Check hostname against gateway domains (`mercadopago`, `mercadolibre`).
  3. If hostname matches a gateway domain, ignore `Referer` and render an HTML success confirmation page (`200 OK`).
  4. Otherwise, redirect to the referer origin.

### 2. Root Handler (`apps/api/src/index.ts`)

- Add `app.get('/', ...)` handler to render an API status HTML page, preventing 404 responses when a browser lands on the domain root.

### 3. Pluralized Client Routing (`apps/mobile/src/`)

- Rename Expo Router directory from `src/app/payment/` to `src/app/payments/`.
- Update `intentFilters.pathPrefix` in `app.config.ts` to `/payments`.
- Update `callbackUrl` in `usePurchase.ts` to `https://${domain}/payments/callback`.
- Update deep link event listener in `usePurchase.ts` to check for `/payments/`.
