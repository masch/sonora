# Design - Migrate Custom URL Scheme to Universal Links / App Links

## Proposed Changes

### API (`apps/api`)

#### [NEW] [association.ts](file:///var/home/masch/dev/js/sonora/apps/api/src/routes/association.ts)

- Create Hono route handlers to serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`.

#### [MODIFY] [index.ts](file:///var/home/masch/dev/js/sonora/apps/api/src/index.ts)

- Mount the association routes globally.

### Mobile App (`apps/mobile`)

#### [MODIFY] [app.config.ts](file:///var/home/masch/dev/js/sonora/apps/mobile/app.config.ts)

- Dynamically configure `associatedDomains` and `intentFilters` based on staging/production environment.

#### [MODIFY] [use-purchase.ts](file:///var/home/masch/dev/js/sonora/apps/mobile/src/hooks/use-purchase.ts)

- Update deep link matching from `sonora://` to support HTTPS domain callbacks.
