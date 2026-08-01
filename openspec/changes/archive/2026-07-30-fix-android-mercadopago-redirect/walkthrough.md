# Walkthrough - Mercado Pago Android Redirect Fix

Resolved the "Unmatched Route" error and purchase mismatch issue when returning from Mercado Pago payment flow on Android.

## Changes Made

### Mobile App

1. **Deep Link Query Parameter Handler**
   - Modified `apps/mobile/src/hooks/use-purchase.ts` to strip query parameters from the incoming redirect URL before splitting it. This ensures that the extracted `purchaseId` matches `pollingRef.current.purchaseId`.

2. **Route Handler Screen**
   - Created `/payment/[status]/[id]` route screen at `apps/mobile/src/app/payment/[status]/[id].tsx`.
   - The handler automatically dismisses any open `WebBrowser` session, fetches the definitive status from the API, registers the purchase/user locally if approved, and redirects the user back to the experience detail screen `/tracks/[experienceId]`.

3. **Translations**
   - Added `success`, `processing`, and `redirecting` translation keys in both English (`packages/shared/src/locales/en.ts`) and Spanish (`packages/shared/src/locales/es.ts`).

## Verification Results

### Automated Tests

- Added a unit test in `apps/mobile/src/__tests__/use-purchase.test.ts` to assert that incoming deep link redirect URLs with query parameters are correctly processed.
- Ran typechecks (`make typecheck`), lints (`make lint`), and tests (`make test`), all of which passed successfully.
