# Proposal - Fix Mercado Pago Return Redirect & Pluralize Payment Routes

Prevent API return route redirect loops to Mercado Pago gateway domains via `Referer` headers, standardize payment routes to plural `/payments/`, and configure native App Links.

## Problem Description

When returning from the Mercado Pago payment flow in staging, MP redirects the user's browser to `GET /payments/return/success/:purchaseId`.
If `purchase.metadata` did not contain a custom `redirectUrl`, the endpoint previously fell back to `c.req.header('Referer')`. Because the request originated from Mercado Pago (`https://sandbox.mercadopago.com.ar` or `https://mercadopago.com.ar`), the API issued a 302 redirect back to Mercado Pago instead of returning to the app.

Furthermore, route naming was fragmented between singular (`/payment`) and plural (`/payments`), causing Android Intent Filters and deep links to miss app link interception.

## Proposed Solution

1. In `apps/api/src/routes/payments.ts`, filter out gateway domains (`mercadopago.com`, `mercadopago.com.ar`, `mercadolibre.com`) when inspecting `Referer` headers.
2. Provide a clean HTML fallback page for direct browser landings when no `redirectUrl` or non-gateway `Referer` is present.
3. Standardize all client routes, callback URLs, and Android Intent Filters to use plural `/payments/` across the entire codebase.
4. Ensure automated tests verify MP referer filtering and plural route handling.
