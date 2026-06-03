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
