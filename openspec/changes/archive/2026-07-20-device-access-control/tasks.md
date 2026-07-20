# Tasks: Device Access Control & Staging Indicator

## Review Workload Forecast

| Field                   | Value       |
| ----------------------- | ----------- |
| Estimated changed lines | ~250        |
| 400-line budget risk    | Low         |
| Chained PRs recommended | No          |
| Suggested split         | Single PR   |
| Delivery strategy       | ask-on-risk |
| Chain strategy          | pending     |

All tasks fit within a single PR.

## Phase 1: Shared Constants & Storage

- [x] 1.1 Add `DEVICE_ID_KEY` to `packages/shared/src/experiences.ts`.
- [x] 1.2 Implement device ID helpers in `apps/mobile/src/storage/app-storage-common.ts` (`getDeviceId()`, `registerDeviceId()`).
- [x] 1.3 Implement device ID helper native exports in `apps/mobile/src/storage/app-storage.ts`.
- [x] 1.4 Implement device ID helper web exports in `apps/mobile/src/storage/app-storage.web.ts`.

## Phase 2: API Changes & DB Migration

- [x] 2.1 Add `device_id` field to `experienceAccesses` table in `apps/api/src/db/schema.ts`.
- [x] 2.2 Generate and run drizzle database migration.
- [x] 2.3 Update API middleware in `apps/api/src/index.ts` to parse device token from header.
- [x] 2.4 Update `/experiences` route to filter audio URLs using device ID logic.
- [x] 2.5 Update `/audio` route to verify device ID in JWT.
- [x] 2.6 Update `/payments` route to log device ID.

## Phase 3: Mobile Client Integration

- [x] 3.1 Update `apps/mobile/src/services/api-client.ts` to fetch and send device ID in Authorization header.
- [x] 3.2 Add `StagingBadge` component under `apps/mobile/src/components/staging-badge.tsx`.
- [x] 3.3 Import and render `StagingBadge` in `apps/mobile/src/app/_layout.tsx` if `isStaging` is true.

## Phase 4: Admin Integration

- [x] 4.1 Add `StagingBadge` component under `apps/admin/src/components/staging-badge.tsx`.
- [x] 4.2 Import and render `StagingBadge` in `apps/admin/src/app/_layout.tsx` if `isStaging` is true.
