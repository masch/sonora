# Specification: Download Manager

## Purpose

Centralizes audio file downloads into a single zustand store (`useDownloadManagerStore`). Manages a FIFO queue with a maximum of 3 concurrent downloads, tracks per-ID status and progress, and exposes enqueue/dequeue operations. Screens subscribe per track ID for reactive status.

## Requirements

### 1. Queue Management

The system MUST maintain a FIFO download queue. Enqueued requests SHALL be appended to the end of the queue.

The system MUST limit concurrent downloads to 3. When all 3 slots are occupied, subsequent requests SHALL wait in the queue.

When an active download completes or fails, the system MUST dequeue the oldest waiting request and start it.

#### Scenario: Immediate start on empty queue

- GIVEN no active downloads
- WHEN `enqueue("track-1", url)` is called
- THEN download starts immediately
- AND `status("track-1")` becomes `downloading`

#### Scenario: Concurrent limit defers to queue

- GIVEN 3 downloads are active
- WHEN `enqueue("track-4", url)` is called
- THEN `status("track-4")` becomes `queued`
- AND no download starts for "track-4"

#### Scenario: FIFO dequeue after completion

- GIVEN 3 active downloads and "track-4" and "track-5" are queued
- WHEN one active download completes
- THEN "track-4" starts (oldest queued)
- AND "track-5" remains queued

#### Scenario: Dequeue after failure

- GIVEN 3 active downloads and "track-4" is queued
- WHEN one active download fails
- THEN "track-4" starts (non-cascading failure)

### 2. Per-ID Status Tracking

The store MUST track status per track ID: `idle | queued | downloading | completed | error`.

The store MUST track progress per track ID as a percentage (0-100).

The store MUST expose `getStatus(trackId)` and `getProgress(trackId)`.

Screens SHALL subscribe to individual track status via a selector.

#### Scenario: Status progression from enqueue to completion

- GIVEN "track-1" has no slot available
- WHEN `enqueue("track-1", url)` is called
- THEN `getStatus("track-1")` returns `queued`
- AND WHEN a slot frees and download starts
- THEN `getStatus("track-1")` returns `downloading`
- AND WHEN download finishes
- THEN `getStatus("track-1")` returns `completed`

#### Scenario: Progress updates during download

- GIVEN "track-1" is downloading
- WHEN bytes are written
- THEN `getProgress("track-1")` reflects the percentage (0-100)

#### Scenario: Error status on failure

- GIVEN "track-1" is downloading
- WHEN network fails
- THEN `getStatus("track-1")` returns `error`
- AND other queued downloads are not affected

### 3. File Storage

Downloads SHALL be saved to `{FileSystem.documentDirectory}tracks/{trackId}/audio.mp3` using `expo-file-system`.

The system MUST ensure the parent directory exists before writing.

### 4. Cache Invalidation and ETag Verification

The system MUST verify the integrity of the local cache against the server before playing or loading a track.

The system MUST fetch headers from the server using a lightweight request (e.g. `Range: bytes=0-0` with cache-control headers) to retrieve the fresh `ETag` or `x-audio-etag` when the device is online.

If the server ETag differs from the locally cached ETag (or if no local ETag exists but a server ETag is present), the system MUST invalidate the local cache by deleting the cached files and resetting the track download status to `idle`.

The system MUST support a robust offline mode: if there is no internet connection or the ETag verification fails or times out (5-second threshold), the local cached version MUST be preserved and played without interruption.
