# Feature Specification: Play Core Startup Update Check

## Requirements

### Requirement 1: Update Check Coordination on Startup

- **Description**: The mobile application MUST initiate an in-app update check on startup without blocking initial UI rendering.
- **Scenario**: App launch
  - **Given** the app launches on an Android device,
  - **When** the root layout mounts,
  - **Then** `updateService.checkForUpdate()` is invoked asynchronously.

### Requirement 2: Flexible Update Triggering / Banner Presentation

- **Description**: When an update is reported available by Google Play Core (`shouldUpdate: true`) and no hard block is active:
  - The app MUST trigger the in-app update flow (or present the update notice to the user).
- **Scenario**: Newer version in Play Store
  - **Given** Google Play Core reports an update is available,
  - **When** `checkForUpdate()` resolves to `true`,
  - **Then** the flexible in-app update flow is triggered.

### Requirement 3: Analytics Instrumentation

- **Description**: In-app update checks and lifecycle events MUST be reported to Firebase Analytics.
- **Scenario**: Tracking startup check
  - **Given** an update check starts,
  - **Then** `update_check_started` is emitted with `source: 'startup'`.
  - **When** the check completes,
  - **Then** `update_check_completed` is emitted with `{ update_available, source: 'startup' }`.
