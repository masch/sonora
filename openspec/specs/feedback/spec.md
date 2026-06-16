# Feedback Specification

## Purpose

Submit post-trip feedback with or without connectivity. Queue locally when offline, auto-sync on reconnect, server deduplicates via idempotency keys.

## Requirements

### Requirement: Feedback Submission

The system MUST provide a text input and submit button. It MUST reject empty or whitespace-only messages.

#### Scenario: Valid submission

- GIVEN the user completed a trip
- WHEN they type "Great trail!" and press submit
- THEN the feedback sends or queues offline AND the UI shows confirmation

#### Scenario: Empty message

- GIVEN the form is open
- WHEN the user submits an empty message
- THEN the form shows a validation error AND the submission is not sent or queued

### Requirement: Offline Queue Storage

When the initial POST fails, the system MUST store the submission to `expo-sqlite/kv-store`. Each queue entry MUST contain `tripId`, `message`, `createdAt`, `idempotencyKey` (UUIDv4), and `retryCount`.

#### Scenario: Queue on failure

- GIVEN the device is offline
- WHEN the user submits valid feedback
- THEN the entry is saved locally AND the UI shows "saved offline"

#### Scenario: Duplicate idempotency key

- GIVEN a queue entry with idempotencyKey `X` exists
- WHEN the user submits feedback with the same `X`
- THEN the system MUST NOT create a duplicate entry

### Requirement: Trigger Modes

The system MUST support three trigger modes per trip via the `feedbackTrigger` field: `audio_end` (player `didJustFinish`), `geofence` (arrival event), and `manual` (trip detail button).

#### Scenario: Each mode opens form

- GIVEN a trip with `feedbackTrigger: "audio_end"`
- WHEN the audio finishes playback
- THEN the feedback form is presented (same for `geofence` and `manual`)

#### Scenario: No trigger defined

- GIVEN a trip without a `feedbackTrigger` field
- THEN the feedback form MUST NOT be presented for any event

### Requirement: Auto-Sync

The system MUST monitor network via `@react-native-community/netinfo` and flush the queue on offline→online transition. Flushed entries MUST be removed on success; MUST remain on failure.

#### Scenario: Flush on reconnect

- GIVEN the queue has 3 pending entries and the device is offline
- WHEN connectivity restores
- THEN all 3 entries POST AND the queue empties

#### Scenario: Partial flush failure

- GIVEN the queue has 3 entries and the 2nd POST fails
- WHEN flush completes
- THEN entry 1 is removed AND entries 2–3 remain for the next retry

### Requirement: API Contract

The server MUST expose `POST /feedback` accepting `{ tripId, message, idempotencyKey, createdAt }`. It MUST return `201` on success and `409` on duplicate `idempotencyKey`.

#### Scenario: Accepted

- GIVEN the client sends valid feedback with a unique idempotencyKey
- WHEN the request arrives
- THEN the server responds `201`

#### Scenario: Duplicate rejected

- GIVEN the server stored feedback with idempotencyKey `X`
- WHEN another POST with `X` arrives
- THEN the server responds `409`

### Requirement: Error Resilience

The system MUST handle network timeout, rapid online/offline toggling, and an empty queue without crashing or showing incorrect state.

#### Scenario: Network timeout

- GIVEN the device is online but the server is unreachable
- WHEN the user submits feedback
- THEN the POST times out AND the entry queues locally

#### Scenario: Rapid toggle

- GIVEN the queue has pending entries
- WHEN connectivity toggles on→off→on within 2 seconds
- THEN flush fires at most once AND no duplicate POSTs occur

#### Scenario: Empty queue flush

- GIVEN the queue is empty
- WHEN network transitions to online
- THEN the flush handler does nothing AND no request is made

### Requirement: Database Schema

The system MUST persist feedback in the `sonora` Postgres schema in a `feedback` table with columns: `id` (SERIAL PRIMARY KEY), `trip_id` (TEXT NOT NULL), `message` (TEXT NOT NULL), `idempotency_key` (TEXT NOT NULL UNIQUE), `created_at` (TIMESTAMPTZ DEFAULT NOW()). The `idempotency_key` UNIQUE constraint is the authoritative deduplication mechanism.

#### Scenario: Migration creates table

- GIVEN the database is empty
- WHEN `make api-db-migrate` runs
- THEN `sonora.feedback` exists with all columns and constraints

#### Scenario: Migration not applied

- GIVEN no migration has been applied
- WHEN POST /feedback is attempted
- THEN the server returns a 5xx error

### Requirement: Feedback Persistence

After returning 201, the system MUST insert a row into `sonora.feedback`. On UNIQUE constraint violation on `idempotency_key`, the system MUST return 409.

#### Scenario: Accepted feedback stored

- GIVEN valid feedback with unique `idempotencyKey`
- WHEN POST /feedback returns 201
- THEN a row exists in `sonora.feedback` matching the submitted data

#### Scenario: Duplicate via UNIQUE constraint

- GIVEN a `sonora.feedback` row with `idempotency_key` X
- WHEN POST /feedback arrives with `idempotencyKey` X
- THEN the server returns 409, regardless of KV state

### Requirement: Dual-Environment Runtime

The same Drizzle schema and handler code MUST work against Docker Postgres 17 (local) and Neon serverless Postgres (Workers).

#### Scenario: Local Docker Postgres

- GIVEN the app runs via `@hono/node-server` with a `pg` Pool
- WHEN feedback is accepted
- THEN data persists in local Docker Postgres 17

#### Scenario: Workers + Neon

- GIVEN the app runs on Cloudflare Workers with `@neondatabase/serverless`
- WHEN feedback is accepted
- THEN data persists in Neon

### Requirement: Idempotency Key Source of Truth

The database UNIQUE constraint on `idempotency_key` SHALL be the authoritative deduplication mechanism. The KV check MAY be used as a fast-path optimization but MUST NOT be the sole arbiter.

#### Scenario: KV miss, DB hit

- GIVEN KV is empty or unavailable for idempotencyKey X
- WHEN a row with `idempotency_key` X already exists in `sonora.feedback`
- THEN POST /feedback with X returns 409

#### Scenario: KV hit prevents DB write

- GIVEN KV contains idempotencyKey X (from a prior accepted submission)
- WHEN POST /feedback with X arrives
- THEN the server returns 409 WITHOUT attempting a DB insert

### Requirement: Feedback Form AutoFocus and Dismissal Confirmation

The feedback form modal MUST support automatic input focusing upon presentation. If the user attempts to dismiss the modal (via backdrop click or close button) while the text input is not empty, the system MUST show a confirmation dialog before discarding.

#### Scenario: AutoFocus on Open

- GIVEN the feedback form modal transitions to visible: true
- THEN the text input MUST automatically take focus AND the keyboard MUST open

#### Scenario: Dismiss empty form

- GIVEN the feedback input is empty
- WHEN the user taps the backdrop or the close button
- THEN the modal MUST close immediately WITHOUT showing a confirmation dialog

#### Scenario: Dismiss form with text (Discarded)

- GIVEN the feedback input contains "Great experience!"
- WHEN the user taps the backdrop or the close button
- THEN the system MUST present a confirmation dialog
- WHEN the user selects "Discard"
- THEN the modal MUST close AND the input text MUST be cleared

#### Scenario: Dismiss form with text (Cancelled)

- GIVEN the feedback input contains "Great experience!"
- WHEN the user taps the backdrop or the close button
- THEN the system MUST present a confirmation dialog
- WHEN the user selects "Keep Editing"
- THEN the modal MUST remain open AND the input text MUST be preserved
