# Specification: Analytics Tracking

## Purpose

Define requirements and validation scenarios for user interaction tracking, network connectivity logging, geofencing activity, and error/crash reporting within the Sonora mobile application.

## Requirements

### Requirement: Event Dispatching

The system MUST log events to the analytics provider when specific user interactions occur.

#### Scenario: Audio Download Started

- GIVEN the user triggers a download for a track
- WHEN the download starts
- THEN the system MUST fire `audio_download_started` with `track_id` and `url`.

#### Scenario: Audio Download Completed

- GIVEN the download is in progress
- WHEN the download completes successfully
- THEN the system MUST fire `audio_download_completed` with `track_id`.

#### Scenario: Audio Download Failed

- GIVEN the download is in progress
- WHEN the download fails
- THEN the system MUST fire `audio_download_failed` with `track_id` and `error_msg`.

#### Scenario: Audio Playback Started

- GIVEN a track is loaded and the user clicks play
- WHEN playback starts
- THEN the system MUST fire `audio_play_started` with `track_id`.

#### Scenario: Audio Playback Completed

- GIVEN a track is playing
- WHEN playback reaches the end of the track
- THEN the system MUST fire `audio_play_completed` with `track_id`.

#### Scenario: Audio Playback Failed

- GIVEN a track is playing or loading
- WHEN an error occurs that interrupts or prevents playback
- THEN the system MUST fire `audio_playback_failed` with `track_id` and `error_msg`.

#### Scenario: Audio Paused

- GIVEN a track is playing
- WHEN the user pauses the audio
- THEN the system MUST fire `audio_paused` with `track_id` and `position_ms`.

#### Scenario: Audio Seeked

- GIVEN a track is playing or paused
- WHEN the user seeks to a new timestamp
- THEN the system MUST fire `audio_seek` with `track_id`, `from_ms`, and `to_ms`.

### Requirement: Connectivity and Usability Tracking

The system MUST track navigation, network connectivity changes, and geofencing actions.

#### Scenario: Screen Viewed

- GIVEN a screen layout renders
- WHEN the screen comes into focus
- THEN the system MUST fire `screen_viewed` with `screen_name`.

#### Scenario: Search Performed

- GIVEN the user is on the explore screen
- WHEN they enter a search query
- THEN the system MUST fire `search_performed` with `query`.

#### Scenario: Connectivity Changed

- GIVEN the network status changes
- WHEN the connection transitions (online <-> offline)
- THEN the system MUST fire `connectivity_changed` with `is_online` and `type` (wifi/cellular/none).

#### Scenario: Geofence Triggered

- GIVEN a user is navigating
- WHEN a waypoint geofence is triggered by GPS coordinates
- THEN the system MUST fire `geofence_triggered` with `experience_id` and `waypoint_id`.

#### Scenario: Geofence Bypassed

- GIVEN a user triggers a bypass of a geofence
- WHEN they click bypass
- THEN the system MUST fire `geofence_bypassed` with `experience_id`.

#### Scenario: Location Permission Result

- GIVEN the app requests location permissions
- WHEN the user grants or denies the permission
- THEN the system MUST fire `location_permission_result` with `granted` (boolean).

### Requirement: Crash and Stability Reporting

The system MUST automatically capture and report fatal unhandled exceptions and JS errors.

#### Scenario: Unhandled Exception Captured

- GIVEN the app is running
- WHEN a fatal Javascript exception or unhandled promise rejection occurs
- THEN Firebase Crashlytics MUST capture and report the exception details automatically.
