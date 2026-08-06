# OpenSpec Proposal: Track Origin Location Map

## Change Name

`track-origin-map`

## Summary

Enable rendering an interactive/static map displaying a single origin point (latitude and longitude) when viewing a `track` in Sonora.

## Problem Statement

Previously, `trip` format experiences supported waypoints and location references on a map, whereas `track` experience views lacked the map display for their origin location.

## Proposed Solution

- Render the `TrackDetailMap` component within `TrackDetailView` when static coordinates (`latitude`, `longitude`) are present on the track.
- Remove redundant metadata rows (Duration, Registry, Location label) to streamline the UI.
- Maintain test coverage via Jest and clean linter status across the repository.
