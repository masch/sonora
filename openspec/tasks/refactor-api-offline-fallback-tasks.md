# Tasks: Refactor API Client — Unified Offline Fallback

- `[x]` Create `apps/mobile/src/services/api-client.ts` with `get`, `post`, `request` methods and automatic GET caching
- `[x]` Migrate `apps/mobile/src/data/experiences.ts` to use `ApiClient.get` with `cacheKey` and `transform`
- `[x]` Migrate `apps/mobile/src/hooks/use-feedback-feed.ts` to use `ApiClient.get`
- `[x]` Migrate `apps/mobile/src/hooks/use-feedback-sync.ts` to use `ApiClient.post`
- `[x]` Migrate `apps/mobile/src/app/(tabs)/messages.tsx` to use `ApiClient.post`
- `[x]` Migrate `apps/mobile/src/components/trip-detail-view.tsx` to use `ApiClient.post`
- `[x]` Migrate `apps/mobile/src/components/track-detail-view.tsx` to use `ApiClient.post`
- `[x]` Create unit tests in `apps/mobile/src/services/__tests__/api-client.test.ts` (26 tests, 100% coverage)
- `[x]` Validate full project with `make validate` (285 tests passing)
