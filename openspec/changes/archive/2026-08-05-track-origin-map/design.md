# Design: Track Origin Map Location

## Architecture and Components

- **Component Reuse**: Reuse `TrackDetailMap` in `TrackDetailView` maintaining prop interface compatibility.
- **Integration**: Mount `TrackDetailMap` when `track.latitude` and `track.longitude` are defined.

## Development Workflow (TDD)

1. **Red Phase**: Write component unit test in `tracks-detail.test.tsx` verifying map presence for tracks with coordinates.
2. **Green Phase**: Connect `TrackDetailMap` within `TrackDetailView`.
3. **Refactor & Cleanup Phase**: Remove obsolete metadata rows and unused translation keys, verifying with `make test` and `make lint`.
