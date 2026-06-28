# Design: Themes List Offline Caching Fallback

Detail the technical changes required to add a cache-aside fallback for the themes list.

## Proposed Changes

### Data Layer

Modify `fetchThemes()` in [experiences.ts](file:///home/masch/dev/js/sonora/apps/mobile/src/data/experiences.ts):

- Add `THEMES_CACHE_KEY = 'themes_list_cache'` to store the cached themes.
- Wrap fetch query logic in a `try/catch` block.
- On success: Write stringified response to local storage cache asynchronously.
- On catch: Log fallback retrieval using `logger.info('[Offline Mode] Fetch failed, loading cached themes...')`, read from local storage, parse and return the data. Catch and log storage errors cleanly.

### Testing Plan

Add automated tests in [experiences-data.test.ts](file:///home/masch/dev/js/sonora/apps/mobile/src/__tests__/experiences-data.test.ts):

- Test that `fetchThemes()` correctly returns and caches themes when online.
- Test that `fetchThemes()` falls back to cached themes when API is offline.
- Test that write/read storage errors are logged correctly and errors propagated if cache is empty.
