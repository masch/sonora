# terms-gate Specification

## Purpose

Enforce that mobile app users review and accept the current terms and conditions before accessing any Sonora features.

## Requirements

### Requirement: Startup Acceptance Verification

The system MUST verify whether the locally stored accepted terms version matches the current backend terms version upon application launch.

#### Scenario: First launch with valid network connection

- GIVEN the application is opened on a device with no recorded terms acceptance in local storage
- WHEN the application initializes
- THEN the system fetches active terms from `GET /terms`
- AND displays the blocking terms modal preventing tab navigation

#### Scenario: Subsequent launch with matching accepted version

- GIVEN the device has stored an accepted terms version equal to the active backend version
- WHEN the application initializes
- THEN the system does not display the terms modal
- AND unblocks normal tab navigation

#### Scenario: Subsequent launch with newer remote version

- GIVEN the device has stored an accepted terms version older than the active backend version
- WHEN the application initializes and checks the remote version
- THEN the system displays the blocking terms modal requiring re-acceptance

### Requirement: Offline Launch Handling

The system MUST display a blocking retry state if active terms cannot be verified on a device that has never accepted terms.

#### Scenario: Offline on first launch

- GIVEN a device with no recorded terms acceptance opens the app without internet connectivity
- WHEN the request to `GET /terms` fails
- THEN the system displays a connection-required blocking error screen
- AND provides a retry button to re-attempt fetching terms without allowing navigation

### Requirement: User Consent Submission

The system MUST persist the accepted version locally and send an audit record to the backend upon user acceptance.

#### Scenario: User clicks accept button

- GIVEN the terms modal is displayed with active terms content
- WHEN the user presses the accept button
- THEN the system submits `POST /terms/accept` with `deviceId`, `version`, `contentHash`, and `platform`
- AND upon success, saves the accepted version in local storage
- AND dismisses the modal to unblock navigation
