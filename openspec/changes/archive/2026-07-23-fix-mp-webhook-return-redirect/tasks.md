# Tasks - Fix Mercado Pago Return Redirect & Pluralize Payment Routes

- [x] Filter payment gateway domains in `GET /payments/return/:status/:purchaseId` referer fallback <!-- id: 0 -->
- [x] Add HTML fallback page for return endpoints and GET / root handler <!-- id: 1 -->
- [x] Pluralize Expo Router payment routes to `src/app/payments/` <!-- id: 2 -->
- [x] Update Android IntentFilter pathPrefix to `/payments` in `app.config.ts` <!-- id: 3 -->
- [x] Update `usePurchase.ts` callbackUrl and deep link listener to use `/payments/` <!-- id: 4 -->
- [x] Update unit tests in `payments.test.ts` and `use-purchase.test.ts` <!-- id: 5 -->
