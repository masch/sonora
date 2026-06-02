# Design: Post-Trip Offline Feedback Queue

## Technical Approach

Dual-layer system: a Hono `POST /feedback` API on Cloudflare Workers, and a client-side offline-first queue backed by `expo-sqlite/kv-store`. A central `useFeedbackTrigger` hook reads the trip's `feedbackTrigger` field, wires the appropriate source (`audio_end` / `geofence` / `manual`), and surfaces a `showFeedback` boolean. The `FeedbackForm` is presented as a `<Modal>` on the trip detail screen. On submit, the form tries a direct POST; on failure (offline or network error), the entry is saved to the queue. A `useNetworkStatus` hook monitors connectivity; on offline→online transitions, `useFeedbackSync` reads all pending entries, POSTs each, and removes on success.

## Architecture Decisions

| Decision           | Choice                            | Alternatives                       | Rationale                                                                                                                       |
| ------------------ | --------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Trigger dispatcher | Central `useFeedbackTrigger` hook | Inline if/else in `TripDetailView` | Keeps trigger logic testable and composable. TripDetailView already dense — avoids 3 condition branches.                        |
| Queue storage      | `expo-sqlite/kv-store`            | AsyncStorage, raw SQLite tables    | Built-in Expo SDK 56 package. ACID, no size limit, simple get/set/remove API. AsyncStorage's ~6MB ceiling is a production risk. |
| API location       | `api/` at project root            | Subdir of `src/`, separate repo    | Standard monorepo layout. Wrangler config stays isolated from RN bundler.                                                       |
| Feedback form      | `<Modal>` from RN                 | Inline card in trip detail         | Non-disruptive after audio/geofence trigger. Follows platform post-action patterns.                                             |
| Idempotency        | UUIDv4 on client                  | Server-generated key               | Client can generate key before offline submit. Server treats as unique constraint — no double-post on retry.                    |

## Data Flow

```
                    ┌─────────────────────────────────┐
                    │       TripDetailView             │
                    │  useFeedbackTrigger(trip)        │
                    │  ── reads feedbackTrigger         │
                    │  ── wires source:                 │
                    │    audio_end → didJustFinish      │
                    │    geofence  → isNearStart change │
                    │    manual    → always visible     │
                    └────────────┬────────────────────┘
                                 │ showFeedback
                                 ▼
                    ┌───────────────────────┐
                    │    FeedbackForm        │
                    │  (modal — RN Modal)   │
                    │  submit(message)       │
                    └──────────┬────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  try POST /feedback     │
                    │  ✓ 201 → done           │
                    │  ✗ offline/fail → queue │
                    └──────────┬──────────────┘
                               │ kv-store entry
                    ┌──────────▼──────────────┐
                    │  useNetworkStatus        │
                    │  (NetInfo listener)       │
                    │  fires on offline→online  │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  useFeedbackSync         │
                    │  peekAll() → POST each   │
                    │  ✓ 201 → remove()        │
                    │  ✗ fail → leave pending  │
                    └─────────────────────────┘
```

## File Changes

| File                                  | Action | Description                                                                      |
| ------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `api/src/index.ts`                    | Create | Hono app: `POST /feedback` route, validates body, stores to configurable binding |
| `api/wrangler.toml`                   | Create | CF Workers config — KV binding for MVP                                           |
| `api/package.json`                    | Create | `hono`, `wrangler` (dev)                                                         |
| `api/tsconfig.json`                   | Create | Worker-compatible TS config                                                      |
| `src/hooks/use-feedback-trigger.ts`   | Create | Reads `feedbackTrigger` from trip data, wires source, exposes `showFeedback`     |
| `src/hooks/use-feedback-queue.ts`     | Create | `expo-sqlite/kv-store` CRUD: `enqueue()`, `peekAll()`, `remove()`                |
| `src/hooks/use-network-status.ts`     | Create | NetInfo wrapper: `{ isOnline }`                                                  |
| `src/hooks/use-feedback-sync.ts`      | Create | Reads pending queue, POSTs each, removes on success                              |
| `src/components/feedback-form.tsx`    | Create | Modal with text input + submit + status states (sending/sent/error/queued)       |
| `src/data/trips.ts`                   | Modify | Add `feedbackTrigger: FeedbackTriggerMode` to `LocalTripMetadata`                |
| `src/components/trip-detail-view.tsx` | Modify | Integrate `useFeedbackTrigger`, render `FeedbackForm` modal                      |
| `src/i18n/locales/en.ts`              | Modify | Add `feedback.*` translation keys                                                |
| `src/i18n/locales/es.ts`              | Modify | Add `feedback.*` translation keys                                                |
| `package.json`                        | Modify | Add `expo-sqlite`, `@react-native-community/netinfo`                             |
| `jest.setup.ts`                       | Modify | Mocks for `expo-sqlite` and NetInfo                                              |

## Interfaces / Contracts

```typescript
// --- Trip data extension (src/data/trips.ts) ---
type FeedbackTriggerMode = 'audio_end' | 'geofence' | 'manual';

interface LocalTripMetadata {
  // ... existing fields
  feedbackTrigger: FeedbackTriggerMode;
}

// --- Feedback queue entry schema ---
interface FeedbackQueueEntry {
  id: string; // UUIDv4 (idempotency key)
  tripId: string;
  message: string;
  createdAt: string; // ISO 8601
  retryCount: number;
  lastError: string | null;
}

// --- API contract: POST /feedback ---
interface FeedbackPostBody {
  tripId: string;
  message: string;
  idempotencyKey: string; // UUIDv4 — server deduplicates
  createdAt: string; // ISO 8601
}
// 201: { status: 'ok' }
// 409: { status: 'duplicate' }  — idempotencyKey already processed
// 422: { status: 'error', errors: [...] }

// --- useFeedbackTrigger return ---
interface FeedbackTriggerResult {
  showFeedback: boolean;
  dismiss: () => void; // resets showFeedback to false
}
```

## Testing Strategy

| Layer       | What to Test                            | Approach                                                               |
| ----------- | --------------------------------------- | ---------------------------------------------------------------------- |
| Unit        | `use-feedback-queue`                    | Mock `expo-sqlite/kv-store`. Enqueue → peek → remove cycle.            |
| Unit        | `use-network-status`                    | Mock NetInfo. Test online→offline→online callback.                     |
| Unit        | `use-feedback-sync`                     | Mock queue + fetch. 201 removes entry, 4xx/5xx/network keeps it.       |
| Unit        | `feedback-form`                         | RTL: render, type text, tap submit, verify `onSubmit(message)`.        |
| Integration | `TripDetailView` with each trigger mode | Each mode opens modal at correct time.                                 |
| API         | Hono route                              | Vitest + miniflare: validation, dedup by idempotencyKey, error shapes. |

## Open Questions

- [ ] KV vs D1 for CF Workers binding — KV is simpler for MVP, D1 enables querying feedback later. Proposal defers this to design phase.
- [ ] Should auto-sync also fire on AppState `active` (app foreground) in addition to NetInfo transitions? Covers the case where app was backgrounded during offline period.
- [ ] Max message length for feedback text? API should reject above N chars (suggest 1000).
- [ ] Server-side dedup storage: does the server keep idempotencyKeys forever, or TTL-based? Suggest 30-day TTL.
