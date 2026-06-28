# Proposal: Themes List Offline Caching Fallback

Provide support for offline caching of themes on the mobile application to allow a complete experiences list cold-start without internet connection.

## Problem Description

Currently, when the mobile application starts offline (cold start), the initial screen loading sequence fails and displays an error view, even if experiences are already cached. This happens because the screen loader executes a `Promise.all` calling both `fetchExperiences()` and `fetchThemes()`. While `fetchExperiences()` has a cache fallback, `fetchThemes()` does not, throwing a network exception immediately when offline and failing the entire loading promise.

## Proposed Solution

Introduce a cache-aside fallback mechanism in `fetchThemes()` identical to the one in `fetchExperiences()` using the project's local key-value store. This will cache the `/themes` API response JSON locally on successful online fetches and retrieve it as a fallback when offline.
