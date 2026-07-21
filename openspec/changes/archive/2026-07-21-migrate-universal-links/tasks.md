# Tasks - Migrate Custom URL Scheme to Universal Links / App Links

- [x] Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` in Hono API (`apps/api/src/routes/association.ts`)
- [x] Configure `associatedDomains` (iOS) and `intentFilters` (Android) dynamically in `apps/mobile/app.config.ts`
- [x] Update deep link listener in `apps/mobile/src/hooks/use-purchase.ts` to capture HTTPS domain callbacks
- [x] Ensure web platform flow runs correctly
- [x] Run all tests and lint checks to ensure codebase is clean
