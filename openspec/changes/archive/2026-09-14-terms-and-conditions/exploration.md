# Exploration: terms-and-conditions

## Current State

Sonora is an Expo SDK 56 universal application with a Cloudflare Workers / Hono backend (`apps/api`).
Currently, app startup in `RootLayout` (`apps/mobile/src/app/_layout.tsx`) initializes remote config, translations, and location tracking. It displays `AnimatedSplashOverlay`, checks `versionStatus` from `useRemoteConfigStore`, and conditionally renders `UpdateRequiredModal` when an update is blocked.
There is no legal terms-and-conditions gating, no local storage persistence for accepted legal versions, and no backend API endpoint for serving terms or storing legally binding consent.

## Affected Areas

- `apps/api/src/db/schema.ts` — Add `termsAcceptances` table with audit fields: `deviceId`, `version`, `contentHash` (SHA-256), `platform`, `ipAddress`, `userAgent`, `acceptedAt`.
- `apps/api/src/routes/terms.ts` — [NEW] Hono router providing `GET /api/terms` and `POST /api/terms/accept`.
- `apps/api/src/index.ts` — Mount terms route at `/api/terms`.
- `packages/shared/src/` — Export shared types and validation schemas (`TermsResponse`, `AcceptTermsRequestSchema`).
- `apps/mobile/src/storage/app-storage.ts` — Helper methods `getAcceptedTermsVersion()` and `setAcceptedTermsVersion()`.
- `apps/mobile/src/components/terms-modal.tsx` — [NEW] Blocking modal/screen matching `TrackDetailView` styling and color system.
- `apps/mobile/src/hooks/use-terms-check.ts` — [NEW] Hook managing API query, version comparison, offline retry, and acceptance submission.
- `apps/mobile/src/app/_layout.tsx` — Integrate terms check and render blocking terms modal during startup.

## Approaches

### Approach 1: Remote Terms with Server-Side Audit Trail & Strict Online Gate (Recommended)

- Dedicated `GET /api/terms` returns current version, content, and SHA-256 hash.
- `POST /api/terms/accept` writes an immutable record to `terms_acceptances` table.
- Mobile client compares remote version against `SqliteStorage`. If missing or older, blocks UI until accepted.
- First launch offline shows an explicit connection-required retry state.
- **Pros:** Full legal compliance, non-repudiation via SHA-256 hash, dynamic update capability without app store re-submissions.
- **Cons:** Network connectivity is required on first launch.
- **Effort:** Medium

### Approach 2: Bundled Static Terms with Client-Only Flag

- Terms content stored in a local markdown/json asset inside mobile bundle; boolean stored in local KV store.
- **Pros:** Works 100% offline on initial launch.
- **Cons:** Cannot update terms dynamically; no server-side audit trail; violates the project requirement for complete legal auditability.
- **Effort:** Low

## Recommendation

Adopt Approach 1. It satisfies the strict legal audit trail requirement by storing immutable acceptance records (`device_id`, `version`, `content_hash`, `platform`, `ip_address`, `user_agent`, `accepted_at`) while enabling future terms updates without app store redeployments.

## Risks

- **Offline on first launch:** Handled by a clear "Connection required to review terms" view with retry action.
- **DB availability:** Guarded with standard Sonora `dbGuard()` and RFC 7807 problem details in Hono API.

## Ready for Proposal

Yes. Proceed with formal proposal generation.
