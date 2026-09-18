# Tasks: Dynamic Experience Credits

## Review Workload Forecast

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low
```

| Metric                       | Value         |
| ---------------------------- | ------------- |
| Estimated changed lines      | 180–250 lines |
| 400-line budget risk         | Low           |
| Chained PRs recommended      | No            |
| Delivery strategy            | single-pr     |
| Decision needed before apply | No            |

## Phase 1: Shared Domain Model (`@sonora/shared`)

- [x] 1.1 Add `ExperienceCredit` interface and optional `credits?: ExperienceCredit[]` to `BaseExperience` in `packages/shared/src/experiences.ts`
- [x] 1.2 Export `ExperienceCredit` from `packages/shared/src/index.ts`
- [x] 1.3 Verify shared package typecheck

## Phase 2: Database Schema & Seeds (`apps/api`)

- [x] 2.1 Add `credits` column (`jsonb('credits').$type<ExperienceCredit[]>()`) to `experiences` in `apps/api/src/db/schema.ts`
- [x] 2.2 Populate credits data for `umepay-bosque` and `texto-maga` in `apps/api/src/db/seed-data.ts`
- [x] 2.3 Write / update API unit test in `apps/api/src/__tests__/experiences.test.ts` verifying credits in `GET /experiences` response

## Phase 3: Mobile UI & i18n (`apps/mobile`)

- [x] 3.1 Add `experiences.credits` translation key in `apps/mobile/src/i18n/locales/`
- [x] 3.2 Write unit tests for `ExperienceCredits` in `apps/mobile/src/__tests__/experience-credits.test.tsx` (RED)
- [x] 3.3 Implement `ExperienceCredits` component in `apps/mobile/src/components/experience-credits.tsx` with Spotify-style card layout (GREEN)
- [x] 3.4 Integrate `ExperienceCredits` at the bottom of `TrackDetailView` and `TripDetailView`
- [x] 3.5 Update existing detail view tests to verify credits render without breaking existing layout

## Phase 4: Quality & Validation

- [x] 4.1 Run unit test suite: `bun test`
- [x] 4.2 Run monorepo typecheck: `make typecheck`
- [x] 4.3 Run linter: `make lint`
