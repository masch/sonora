# Specification - Fix Mercado Pago Android Redirect Route Mismatch

## Requirements

1. **Route Handling**: Create dynamic routes `/payment/success/[id]`, `/payment/failure/[id]`, and `/payment/pending/[id]` (or `/payment/[status]/[id]`) to capture all possible redirection states from Mercado Pago.
2. **Deep Link Parsing**: Strip query parameters appended by Mercado Pago from deep link URLs before extracting the `purchaseId` to match against `pollingRef.current.purchaseId`.
3. **User Redirection**: Dismiss WebBrowser sessions, verify the payment status from the backend, update local purchase cache, and redirect back to `/tracks/[experienceId]`.
