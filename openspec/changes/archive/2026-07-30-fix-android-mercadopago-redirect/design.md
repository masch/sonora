# Design - Fix Mercado Pago Android Redirect Route Mismatch

## Proposed Changes

### Mobile App

#### [NEW] [id.tsx](file:///var/home/masch/dev/js/sonora/apps/mobile/src/app/payment/%5Bstatus%5D/%5Bid%5D.tsx)

- Create a dynamic route `/payment/[status]/[id]` to capture success, failure, and pending redirections.
- Fetch the payment status to retrieve the `experienceId`.
- Save the purchased ID/email if successful, and redirect the user back to the corresponding track details screen `/tracks/[experienceId]`.

#### [MODIFY] [use-purchase.ts](file:///var/home/masch/dev/js/sonora/apps/mobile/src/hooks/use-purchase.ts)

- Update the deep link listener to correctly parse the `purchaseId` by stripping query parameters from the URL before extracting the last path segment.
