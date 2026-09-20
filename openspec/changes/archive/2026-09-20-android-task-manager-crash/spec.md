# Feature Specification: Safe Background Task Registration and Lifecycle

## Requirements

### Requirement 1: Non-Persistent Background Fetch Registration

- **Description**: Background tasks for feedback synchronization MUST NOT persist across device reboots or process termination.
- **Scenario**: Registering background sync task
  - **Given** an Android or iOS device running Sonora,
  - **When** `useRegisterBackgroundTask` or `useBackgroundSync` registers the task,
  - **Then** `stopOnTerminate` MUST be `true` and `startOnBoot` MUST be `false`.
  - **And** Android's `AlarmManager` will not schedule persistent alarms that wake the process while terminated.

### Requirement 2: Legacy Zombie Alarm Cleanup

- **Description**: Existing app installations with persistent alarms registered under previous options (`startOnBoot: true`, `stopOnTerminate: false`) MUST be cleaned up and replaced with safe configuration.
- **Scenario**: Device with legacy task registered
  - **Given** an existing installation where `TaskManager.isTaskRegisteredAsync(taskName)` is `true`,
  - **When** the app updates and initializes `useRegisterBackgroundTask`,
  - **Then** the hook unregisters and re-registers the task with `stopOnTerminate: true` and `startOnBoot: false` so `AlarmManager.cancel()` clears the pending broadcast intent.

### Requirement 3: Headless Execution Guard

- **Description**: Background fetch MUST only execute when the application environment and React Native bridge are active.
- **Scenario**: Background fetch triggered
  - **Given** the task is triggered by the system,
  - **When** the task handler executes,
  - **Then** it safely flushes the feedback queue and returns `BackgroundFetchResult.NewData` or `BackgroundFetchResult.NoData`, without throwing unhandled exceptions.
