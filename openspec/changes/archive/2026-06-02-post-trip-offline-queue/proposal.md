# Proposal: Post-Trip Offline Feedback Queue

## Intent

Let hikers submit feedback after completing a trail walk, even when offline. Queue locally via `expo-sqlite/kv-store`, POST to a Hono API on Cloudflare Workers, and auto-sync when connectivity returns.

## Scope

### In Scope

- Backend: Hono `POST /feedback` endpoint on Cloudflare Workers
- Client: `FeedbackForm` component (text input + submit + status states)
- Client: Offline queue via `expo-sqlite/kv-store`
- Client: Network monitoring via `@react-native-community/netinfo`
- Client: Auto-sync flush on connectivity restore
- Client: 3 trigger modes, **configurable per trip** via `feedbackTrigger` field
  - `audio_end`: form aparece al terminar el audio (`didJustFinish`)
  - `geofence`: form aparece al llegar al destino geográfico
  - `manual`: botón "Dejar feedback" siempre disponible
- Trip data extended with `feedbackTrigger: "audio_end" | "geofence" | "manual"`
- i18n: Spanish + English translations for all new UI strings

### Out of Scope

- Background fetch / background sync (MVP flushes on app foreground only)
- Authentication, rate limiting, or spam protection
- File attachments, photos, or media in feedback
- Admin dashboard or feedback viewing UI
- Exponential retry or backoff (MVP retries on next online event)

## Capabilities

### New Capabilities

- `feedback`: Post-trip feedback submission with offline queue and HTTP sync

### Modified Capabilities

- None

## Approach

Dual-layer system:

1. **API** — Hono app on Cloudflare Workers. Single `POST /feedback` route. Validates body (`tripId`, `message`, `timestamp`, `idempotencyKey`). Stores to configurable binding (KV or D1 — TBD at design phase).

2. **Client** — `FeedbackForm` is triggered by one of 3 modes, configurable per trip via `feedbackTrigger`:
   - `audio_end`: after `useImmersionPlayer.didJustFinish`
   - `geofence`: after `useOfflineGeofence` fires arrival
   - `manual`: button on trip detail screen

   On submit: try direct POST. If offline or fails, save entry to `expo-sqlite/kv-store` queue. NetInfo listener fires on app foreground; when online, flushes all pending entries via POST. On success, delete from queue. On failure, leave for next retry.

Queue entry schema: `{ id, tripId, message, createdAt, idempotencyKey, retryCount, lastError }`.

## Affected Areas

| Area                                | Impact   | Description                                                      |
| ----------------------------------- | -------- | ---------------------------------------------------------------- |
| `src/hooks/use-immersion-player.ts` | Modified | Wire `didJustFinish` to trigger feedback flow (`audio_end` mode) |
| `src/hooks/use-offline-geofence.ts` | Modified | Wire arrival event to trigger feedback flow (`geofence` mode)    |
| `src/components/feedback-form.tsx`  | New      | Text input + submit + sending/sent/error states                  |
| `src/hooks/use-feedback-queue.ts`   | New      | `expo-sqlite/kv-store` CRUD + flush logic                        |
| `src/hooks/use-network-status.ts`   | New      | NetInfo listener, exposes `isOnline`                             |
| `src/data/trips.ts`                 | Modified | Add `feedbackTrigger` field to trip data types                   |
| `src/i18n/locales/en.ts`            | Modified | Feedback translation keys                                        |
| `src/i18n/locales/es.ts`            | Modified | Feedback translation keys                                        |
| `package.json`                      | Modified | Add `expo-sqlite`, `@react-native-community/netinfo`             |
| `jest.setup.ts`                     | Modified | Mocks for `expo-sqlite`, NetInfo                                 |
| `api/` (new dir)                    | New      | Hono + Wrangler project for CF Workers                           |

## Risks

| Risk                                | Likelihood | Mitigation                                                 |
| ----------------------------------- | ---------- | ---------------------------------------------------------- |
| No DB binding chosen for CF Workers | Med        | Defer to design phase; API accepts configurable binding    |
| Duplicate feedback on lost response | Med        | `idempotencyKey` (UUIDv4) per request, server deduplicates |
| iOS background sync limited         | Low        | Acceptable for MVP; sync fires on app foreground           |
| Race on rapid online/offline events | Low        | Debounce NetInfo handler, idempotent flush                 |

## Rollback Plan

- Client: feature flag to conditionally render `FeedbackForm`
- API: `wrangler rollback` to previous deployment
- Full revert: merge revert PR

## Dependencies

- `expo-sqlite` (needs install — built-in Expo SDK 56 package)
- `@react-native-community/netinfo` (needs install)
- Hono + Wrangler (dev deps for API project)

## Success Criteria

- [ ] `FeedbackForm` appears according to each trip's `feedbackTrigger` mode: audio_end, geofence, manual
- [ ] With no network, form submit saves to local queue
- [ ] On connectivity restore, pending entries auto-POST to API
- [ ] Server deduplicates by `idempotencyKey` (no duplicates on lost response)
- [ ] `make validate` passes (lint, typecheck, tests)
