# Proposal - Migrate Custom URL Scheme to Universal Links / App Links

Migrate the mobile application from using the custom URL scheme `sonora://` for deep linking to modern, collision-free Universal Links (iOS) and App Links (Android) using the `https://sonora.app` domain (and `https://staging.sonora.app` for staging).

## Problem Description

The payment flow redirect currently uses a custom URL scheme `sonora://payment/callback` to return the user back to the mobile application after completing a Mercado Pago checkout session. While functional, custom schemes:

1. Suffer from potential naming conflicts if another app on the device registers the same scheme (especially on Android where a conflict chooser dialog can pop up).
2. Are less secure and don't provide the verified app-ownership association that Universal/App Links offer.

Additionally, the redirect must continue to work seamlessly for the web version of the application.
