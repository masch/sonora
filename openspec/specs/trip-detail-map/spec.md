# Trip Detail Map Specification

## Purpose

Define the requirements for displaying the trip detail map, user GPS location, destination marker, and transition states in a smooth, non-flickering manner.

## Requirements

### Requirement: DestMarkerRendering

The system MUST render a destination marker at the coordinates (`latitude`, `longitude`) passed to the map.

#### Scenario: Display Destination Marker

- GIVEN the map screen loads
- WHEN the destination coordinates are loaded
- THEN the map MUST initialize centered on those coordinates
- AND a destination marker MUST be rendered at the target location

---

### Requirement: UserMarkerAcquisition

The system SHOULD display the user's current GPS location on the map using a custom marker if coordinates are provided. If the user's coordinates are unavailable, the system MUST display a location loading feedback message.

#### Scenario: User Location Unacquired

- GIVEN the map is loaded
- WHEN `userLatitude` and `userLongitude` are undefined/null
- THEN the map MUST display a "Locating..." message/badge overlay
- AND no user marker should be rendered on the map

#### Scenario: User Location Acquired

- GIVEN the map is loaded with a "Locating..." overlay visible
- WHEN `userLatitude` and `userLongitude` coordinates are successfully acquired
- THEN the "Locating..." overlay MUST hide
- AND a user marker MUST be rendered on the map at the user's position

---

### Requirement: SmoothPositionUpdates

When the user's GPS coordinates change, the map MUST update the user marker's position in-place and SHOULD pan smoothly to the new position without reloading the map view, repainting tiles, or resetting user-defined zoom.

#### Scenario: User Marker Moves Smoothly

- GIVEN a user marker is already displayed on the map
- WHEN new `userLatitude` and `userLongitude` coordinates are received
- THEN the user marker MUST transition to the new location in-place
- AND the map view MUST pan smoothly (animated) to fit the new coordinates
- AND the map web view/instance MUST NOT reload or flicker
