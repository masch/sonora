# Delta for Trip Playback and Tracking

## ADDED Requirements

### Requirement: Geofence Blocked-State Banner

When `isPlaybackBlocked` is true, the system MUST render a prominent banner card (not just inline text) containing a location-pin icon, an explanation that the user must be within 50m of the start point, and the current distance from start (`geofence.distanceMeters`). The banner MUST match the `card-container` styling pattern used by `GpsPrecisionBadge`.

#### Scenario: Blocked banner renders with distance

- GIVEN `isPlaybackBlocked` is true and `geofence.distanceMeters` is 120
- WHEN the TripDetailView renders
- THEN a banner card is displayed with a location-pin icon, the text "Necesitás estar a menos de 50m del punto de inicio", and "Distancia actual: 120m"
- AND the banner does NOT render when `isPlaybackBlocked` is false

#### Scenario: Blocked banner uses i18n keys

- GIVEN `isPlaybackBlocked` is true
- WHEN the banner renders
- THEN all text uses translated keys from `experiences.geofenceBlocked.*` in both `es.ts` and `en.ts`

### Requirement: Proximity Alert on Blocked Play/Download

When `isPlaybackBlocked` is true, tapping the play or download button MUST show an `Alert.alert()` (or `window.confirm` on web) explaining why playback is blocked, instead of the button being silently disabled. The `disabled` prop on `UnifiedAudioController` MUST NOT include `isPlaybackBlocked` for this purpose.

#### Scenario: Tap play while blocked shows alert

- GIVEN `isPlaybackBlocked` is true
- WHEN the user taps the play button
- THEN an Alert is shown with title and message explaining the proximity requirement
- AND playback does NOT start
- WHEN the user taps "Got it"
- THEN the alert dismisses AND playback still does not start

#### Scenario: Tap download while blocked shows alert

- GIVEN `isPlaybackBlocked` is true
- WHEN the user taps the download button
- THEN an Alert is shown explaining the proximity requirement
- AND the download does NOT start

#### Scenario: Play while on-site proceeds normally

- GIVEN `isPlaybackBlocked` is false AND `showBypassWarning` is false
- WHEN the user taps play
- THEN `player.play()` is called directly WITHOUT any alert

#### Scenario: Play while on-site with bypass warning still works

- GIVEN `isPlaybackBlocked` is false AND `showBypassWarning` is true
- WHEN the user taps play
- THEN the existing bypass alert is shown (unchanged behavior)

## MODIFIED Requirements

### Requirement: PlaybackRestriction

The system MUST enforce that the user's current GPS location is within the starting geofence before playback of a Trip can begin. When blocked, a prominent banner card with current distance replaces the previous inline text, and tapping the play button triggers an explanation alert instead of being silently disabled.
(Previously: a small red inline `<ThemedText>` with `mustBeOnSite` text was shown, and the play button was disabled.)

#### Scenario: User is on-site

- GIVEN the user is on the detail screen for a Trip
- AND the user's distance to the start coordinates is <= 50 meters
- WHEN the user presses the play button
- THEN the system MUST allow playback of the audio

#### Scenario: User is off-site (blocked UI)

- GIVEN the user is on the detail screen for a Trip
- AND the user's distance to the start coordinates is > 50 meters
- WHEN the user views the screen
- THEN a prominent banner card renders with icon, explanation, and current distance
- WHEN the user presses the play button
- THEN the system MUST NOT allow playback
- AND MUST show an Alert explaining the proximity requirement
- AND `GpsPrecisionBadge` continues to show GPS detail data

## REMOVED Requirements

None.

## RENAMED Requirements

None.
