# Trip Playback and Tracking Specification

## Purpose

Define the requirements for interactive trips, ensuring the user is located at the starting geofence to play content and tracking their progress along multiple dynamic checkpoints/waypoints.

## Requirements

### Requirement: PlaybackRestriction

The system MUST enforce that the user's current GPS location is within the starting geofence before playback of a Trip can begin.

#### Scenario: User is on-site

- GIVEN the user is on the detail screen for a Trip
- AND the user's distance to the start coordinates is <= 50 meters
- WHEN the user presses the play button
- THEN the system MUST allow playback of the audio.

#### Scenario: User is off-site

- GIVEN the user is on the detail screen for a Trip
- AND the user's distance to the start coordinates is > 50 meters
- WHEN the user presses the play button
- THEN the system MUST NOT allow playback
- AND MUST display a message indicating they need to be on-site.

### Requirement: WaypointTracking

For Trips, the system MUST track the user's GPS coordinates and mark checkpoints/waypoints as completed when they enter their respective radius.

#### Scenario: Pass checkpoint

- GIVEN the user is playing a Trip
- WHEN the user enters the radius of the next pending waypoint/checkpoint
- THEN the system MUST mark that checkpoint as completed
- AND MAY play an audio segment associated with that checkpoint if configured.
