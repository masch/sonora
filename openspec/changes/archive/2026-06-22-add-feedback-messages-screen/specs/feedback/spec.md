# Delta for Feedback

## ADDED Requirements

### Requirement: Feedback Message Feed UI

The system MUST provide a "Mensajes" tab screen showing a list of feedbacks submitted by the community. The screen MUST follow a dual filter sub-tab layout:

- **Todos**: Displays all feedback entries fetched from the backend.
- **Cercanos**: Displays feedback entries filtered by proximity (using client-side Haversine distance, showing only entries within 500 meters of the user's current GPS location).

#### Scenario: View all messages

- GIVEN the user is on the "Mensajes" tab
- WHEN they select the "Todos" filter
- THEN the system fetches and lists all community feedback messages in chronological order.

#### Scenario: View nearby messages

- GIVEN the user is on the "Mensajes" tab and has active GPS location coordinates
- WHEN they select the "Cercanos" filter
- THEN the system filters the fetched feedback entries and displays only those located within 500 meters of the user's current coordinates.

### Requirement: Feedback Manual Submission from Messages Screen

The "Mensajes" tab screen MUST provide a "+ Mensaje nuevo" button. Triggering this button MUST open the standard feedback submission form modal.

#### Scenario: Trigger feedback form manually

- GIVEN the user is on the "Mensajes" tab screen
- WHEN they tap "+ Mensaje nuevo"
- THEN the feedback submission modal form is presented.

---

## MODIFIED Requirements

### Requirement: Offline Queue Storage

When the initial POST fails, the system MUST store the submission to `expo-sqlite/kv-store`. Each queue entry MUST contain `tripId`, `message`, `createdAt`, `idempotencyKey` (UUIDv4), `retryCount`, and optional GPS coordinates (`latitude`, `longitude`).
(Previously: Queue entry stored only tripId, message, createdAt, idempotencyKey, and retryCount.)

#### Scenario: Queue on failure with location

- GIVEN the device is offline and has GPS location coordinates
- WHEN the user submits valid feedback
- THEN the entry (including `latitude` and `longitude`) is saved locally AND the UI shows "saved offline".

### Requirement: API Contract

The server MUST expose `POST /feedback` accepting `{ tripId, message, idempotencyKey, createdAt, latitude, longitude }`. It MUST return `201` on success and `409` on duplicate `idempotencyKey`.
(Previously: Server accepted POST /feedback with only tripId, message, idempotencyKey, and createdAt.)

#### Scenario: Accepted POST with location

- GIVEN the client sends valid feedback with latitude, longitude and a unique idempotencyKey
- WHEN the request arrives
- THEN the server responds `201` and persists the coordinates in the database.

### Requirement: Database Schema

The system MUST persist feedback in the `sonora` Postgres schema in a `feedback` table with columns: `id` (SERIAL PRIMARY KEY), `trip_id` (TEXT NOT NULL), `message` (TEXT NOT NULL), `idempotency_key` (TEXT NOT NULL UNIQUE), `created_at` (TIMESTAMPTZ DEFAULT NOW()), and optional `latitude` (DOUBLE PRECISION), `longitude` (DOUBLE PRECISION).
(Previously: DB schema table feedbacks did not include latitude and longitude columns.)

#### Scenario: Migration adds columns

- GIVEN the database is updated
- WHEN the migration runs
- THEN `sonora.feedback` has `latitude` and `longitude` double precision columns.
