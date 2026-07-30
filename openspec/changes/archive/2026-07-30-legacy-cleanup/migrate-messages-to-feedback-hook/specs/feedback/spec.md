# Delta for Feedback

## ADDED Requirements

### Requirement: Location Auto-Inclusion in Feedback Submission

The system MUST automatically include the user's current GPS coordinates (`latitude`, `longitude`) from `useLocationStore` in every feedback submission payload and offline queue entry. Consumers MUST NOT pass coordinates explicitly — the shared hook (`useFeedbackSubmit`) fetches them internally.

#### Scenario: Submit with active GPS

- GIVEN `useLocationStore` returns `{ coords: { latitude: -34.61, longitude: -58.38 } }`
- WHEN `submitFeedback` is called
- THEN `latitude: -34.61` and `longitude: -58.38` are included in the `ApiClient.post` payload
- AND `latitude: -34.61` and `longitude: -58.38` are included in the `feedbackQueue.enqueue` input

#### Scenario: GPS not yet initialized

- GIVEN `useLocationStore` returns `{ coords: null }`
- WHEN `submitFeedback` is called
- THEN `latitude` and `longitude` are omitted from the `ApiClient.post` payload
- AND `latitude` and `longitude` are omitted from the `feedbackQueue.enqueue` input

## MODIFIED Requirements

### Requirement: Feedback Manual Submission from Messages Screen

The "Mensajes" tab screen MUST provide a "+ Mensaje nuevo" button. Triggering this button MUST open the standard feedback submission form modal. The form MUST use `useFeedbackSubmit` for submission instead of direct `ApiClient.post`.
(Previously: MessagesScreen used `useReducer` + `handleManualSubmit` calling `ApiClient.post` and `enqueue` directly.)

#### Scenario: Trigger feedback form manually

- GIVEN the user is on the "Mensajes" tab screen
- WHEN they tap "+ Mensaje nuevo"
- THEN the feedback submission modal form is presented

#### Scenario: Submit feedback via hook

- GIVEN the feedback form is open on MessagesScreen
- WHEN the user types a message and submits
- THEN `useFeedbackSubmit.submitFeedback` is called with `APP_CONFIG.feedback.generalExperienceId` and the message text
- AND the modal closes on success (sent or queued)

#### Scenario: Offline queue from MessagesScreen

- GIVEN the device is offline
- WHEN the user submits feedback via the Messages form
- THEN the entry is queued locally with `experienceId: "general-feedback"` and the user's GPS coordinates
- AND the UI shows "saved offline"

## REMOVED Requirements

None.

## RENAMED Requirements

None.
