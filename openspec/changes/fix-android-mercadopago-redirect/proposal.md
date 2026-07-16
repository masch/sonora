# Proposal - Fix Mercado Pago Android Redirect Route Mismatch

Resolve the "Unmatched Route" error when returning from Mercado Pago payment flow on Android.

## Problem Description

The app redirects back from Mercado Pago using deep link URLs such as `sonora://payment/success/[purchaseId]`. Currently, the app does not have a route defined for `/payment/success/[id]`, `/payment/failure/[id]`, or `/payment/pending/[id]`, resulting in Expo Router rendering the "Unmatched Route" screen.

Additionally, query parameters appended by Mercado Pago to the URL prevent the purchase ID from matching the polling state in `usePurchase`.
