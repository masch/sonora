# Design: Device Access Control & Staging Indicator

Device-based access control restricts signed audio URLs to the device that has access, and a Staging environment visual indicator distinguishes the staging builds.

## Quick Path

1. **Shared**: Add `DEVICE_ID_KEY` to `packages/shared/src/experiences.ts`.
2. **Database**: Add `device_id` column to `experience_accesses` and generate migration.
3. **Backend**: Read authorization header, sign JWT with device ID, filter `/experiences` based on device access.
4. **Mobile**: Persist/generate device ID, send Bearer token.
5. **Staging Indicator**: Build `StagingBadge` and mount it in layouts when `isStaging` is true.

## Architecture Decisions

| Topic                 | Choice                                              | Rationale                                                                    |
| --------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Device ID**         | Local storage / localStorage UUID v4                | Easy to implement and portable across native and web origins.                |
| **Auth Transport**    | `Authorization: Bearer device:<uuid>`               | Clean HTTP standard, easily parsed by Hono middleware.                       |
| **Staging Detection** | `EXPO_PUBLIC_API_URL` check + `process.env.APP_ENV` | Reliable across both mobile native and web builds.                           |
| **Visual Badge**      | Floating absolute badge in `_layout.tsx`            | Non-intrusive, zero impact on structural page layouts, works on all screens. |

## File Changes

| File                                            | Action | Description                                              |
| ----------------------------------------------- | ------ | -------------------------------------------------------- |
| `packages/shared/src/experiences.ts`            | MODIFY | Add `DEVICE_ID_KEY` constant.                            |
| `apps/api/src/db/schema.ts`                     | MODIFY | Add `device_id` column to `experienceAccesses`.          |
| `apps/api/src/index.ts`                         | MODIFY | Add middleware to extract device token from auth header. |
| `apps/api/src/routes/experiences.ts`            | MODIFY | Filter audio URLs based on device access log.            |
| `apps/api/src/routes/audio.ts`                  | MODIFY | Sign and verify JWT containing `deviceId`.               |
| `apps/api/src/routes/payments.ts`               | MODIFY | Store `device_id` in access record on purchase.          |
| `apps/mobile/src/storage/app-storage-common.ts` | MODIFY | Add `getDeviceId()` / `registerDeviceId()` helpers.      |
| `apps/mobile/src/storage/app-storage.ts`        | MODIFY | Export native helpers.                                   |
| `apps/mobile/src/storage/app-storage.web.ts`    | MODIFY | Export web helpers.                                      |
| `apps/mobile/src/services/api-client.ts`        | MODIFY | Attach device auth header.                               |
| `apps/mobile/src/components/staging-badge.tsx`  | NEW    | Floating Staging Badge UI.                               |
| `apps/mobile/src/app/_layout.tsx`               | MODIFY | Mount StagingBadge.                                      |
| `apps/admin/src/components/staging-badge.tsx`   | NEW    | Floating Staging Badge UI for Admin.                     |
| `apps/admin/src/app/_layout.tsx`                | MODIFY | Mount StagingBadge in Admin.                             |
