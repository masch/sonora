# Specification - Fix Mercado Pago Return Redirect & Pluralize Payment Routes

## Requirements

### Requirement: Prevent Gateway Domain Redirect Loop

The GET `/payments/return/:status/:purchaseId` route SHALL NOT use the `Referer` header as a redirect destination if the domain belongs to a payment provider gateway (`mercadopago.com`, `mercadopago.com.ar`, `mercadolibre.com`).

#### Scenario: Payment completed on Mercado Pago without explicit redirectUrl

Given a user returning from Mercado Pago checkout to `/payments/return/success/123`
And the `Referer` header is `https://sandbox.mercadopago.com.ar/checkout/v1/...`
When the endpoint processes the return request
Then it MUST NOT redirect to `https://sandbox.mercadopago.com.ar`
And it MUST render an HTML success confirmation page with status 200.

### Requirement: Pluralized Payment Routes and App Link Interception

All payment routes across client and backend components SHALL use the plural prefix `/payments/`.

#### Scenario: Android Native App Link Interception

Given an Android user completing payment
When Mercado Pago redirects to `https://<domain>/payments/callback`
Then the Android OS Intent Filter configured with `pathPrefix: "/payments"` MUST intercept the URL and reopen the native app directly.
