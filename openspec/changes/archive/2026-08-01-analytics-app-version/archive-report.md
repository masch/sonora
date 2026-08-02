# Archive Report — 2026-08-01-analytics-app-version

## Status: CLOSED

**Change**: Include app version in all frontend activity logs and API requests
**Branch**: feat/analytics-app-version
**Commit**: 24d8c22 (rebased onto origin/main)
**PR**: #366 — <https://github.com/masch/sonora/pull/366>
**Archived**: 2026-08-02

## Outcome

All requirements implemented, verified, and delivered:

- **FR-1/2/3**: `app_version` (version name only) on Firebase Analytics events (native + web), errors (`recordError`), and mobile console logs (`logger.ts` wrapper).
- **FR-4**: value from `getAppVersion().versionName` (single source of truth, helper untouched).
- **FR-7 (user-approved extension)**: `X-App-Version` header on all frontend API requests (`getAuthHeader` + `fetchWithDeviceId` via shared `buildBaseHeaders`), CORS allowlist updated (documented NFR-1 exception, required for web preflight).
- **GGA findings (user-approved)**: event-map drift fixed via shared `analytics-events.ts` (PaymentEvents was missing on web), `ensureWebInitialized` retry semantics, `promise` moved to dependencies, `fetchWithDeviceId` error logging consistency.

## Verification

- `make validate` **EXIT 0** (format, lint, typecheck, api-typecheck, scripts-typecheck, doctor-ci, test, gga) — gga required `GGA_TIMEOUT=900` (provider flake, not code).
- Jest: logger 13/13, analytics 5/5 (native + web), api-client 32/32, API cors 15/15.
- `packages/shared` byte-identical; API changes limited to the single documented CORS allowlist entry.
- Runtime ledger: attempts settled `complete`.

## Delivery

RDD disabled (global) → delivery `disabled/unmanaged` under ordinary repository policy; no receipt fabricated. PR #366 open, MERGEABLE, head SHA 24d8c22. All CI checks green except `openspec-archived` which this archive resolves.
