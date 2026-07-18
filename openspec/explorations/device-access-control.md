# Device-Based Access Control for Experiences

## Problem

`GET /experiences` returns signed JWT URLs for **all** experiences regardless of purchase status. The JWT only prevents URL reuse after 15 minutes — it does not verify that the caller owns the content. Access control is entirely client-enforced via local cache.

## Current State

| Layer                      | Mechanism                                                              | Gap                                         |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| **API: GET /experiences**  | Signs JWT `{ key, exp }` for every experience with a non-http audioUrl | Returns URLs for paid experiences to anyone |
| **API: GET /audio/stream** | Verifies JWT `{ key, exp }`, streams from R2                           | No user/device check                        |
| **Mobile: usePurchase**    | Checks local KV cache + email restore                                  | Only affects UI, not API access             |
| **API: payments**          | Purchases tied to `email`, no device concept                           | Can't bind access to a device               |
| **Auth: BaseApiClient**    | Has `getAuthToken` hook for Bearer tokens                              | Not configured — no auth sent               |

## Proposed Solution: Device Token + Server-Side Filter

### 1. Device Identity

Generate a UUID v4 on first launch, persist in app-storage KV:

- **Native**: `expo-application.getIosIdForVendorAsync()` / `Application.androidId`
- **Web**: Generate UUID, store via `localStorage` (existing `app-storage.web.ts`)
- **Key**: `device_id` in the existing KV store

### 2. ApiClient Sends Device ID

The mobile `ApiClient` passes a `getAuthToken` that reads the device ID from storage:

```ts
getAuthToken: async () => {
  const deviceId = await getDeviceId();
  return deviceId ? `device:${deviceId}` : null;
};
```

Sent as `Authorization: Bearer device:<uuid>` on every request.

### 3. Backend: Middleware Extracts Device ID

A Hono middleware on the experiences/payments group reads the Bearer token, extracts the device ID, and makes it available on `c.var`.

### 4. Backend: `experienceAccesses` Tracks Devices

Add `device_id` column (nullable, for backward compat).

When a purchase is approved (webhook), the backend also records the device ID from the access log or purchase flow.

### 5. Backend: GET /experiences Filters Audio URLs

When a device ID is present:

- Look up accessible experience IDs from `experienceAccesses` where `device_id = x`
- Free experiences are always accessible
- Only sign JWT URLs for accessible paid experiences
- Return `audioUrl: null` for restricted ones

When no device ID is present (legacy clients):

- Return `audioUrl: null` for paid experiences
- Free experiences work as before

### 6. Backend: GET /audio/stream Verifies Access

Instead of the current `{ key, exp }` JWT, include `deviceId` in the payload:

```
{ key, deviceId, exp }
```

The experiences endpoint signs this JWT only when the device has access. The stream endpoint verifies all three fields.

## Database Changes

```sql
ALTER TABLE sonora.experience_accesses ADD COLUMN device_id text;
CREATE INDEX idx_experience_accesses_device_id ON sonora.experience_accesses(device_id);
```

## Changes Per Layer

| Layer      | Files                                | Change                                     |
| ---------- | ------------------------------------ | ------------------------------------------ |
| **Shared** | `packages/shared/src/experiences.ts` | Add `DEVICE_ID_KEY` constant               |
| **Mobile** | `storage/app-storage-common.ts`      | Add `getDeviceId()` / `registerDeviceId()` |
| **Mobile** | `storage/app-storage.ts`             | Export device ID functions                 |
| **Mobile** | `storage/app-storage.web.ts`         | Export device ID functions                 |
| **Mobile** | `services/api-client.ts`             | Pass `getAuthToken` reading device ID      |
| **Mobile** | `hooks/use-purchase.ts`              | No change — auth header is transparent     |
| **API**    | `src/index.ts`                       | Add middleware to parse device token       |
| **API**    | `src/routes/experiences.ts`          | Filter audio URLs by device access         |
| **API**    | `src/routes/audio.ts`                | Verify device ID in JWT                    |
| **API**    | `src/routes/payments.ts`             | Accept device ID in access/restore         |
| **API**    | `db/schema.ts`                       | Add `deviceId` to `experienceAccesses`     |
| **API**    | `db/seed.ts`                         | No change                                  |
| **API**    | `wrangler*.toml`                     | No change                                  |

## Migration

1. Deploy backend first: add nullable `device_id` column, update `/experiences` to filter when header is present
2. Deploy mobile: generate device ID, start sending `X-Device-Id` header
3. Old clients without device ID get `audioUrl: null` for paid experiences (they already can't play them without purchasing; the UI will handle it)
4. Remove legacy JWT verification after all clients are updated

## Open Questions

1. **Device portability**: If user changes device, email restore flow binds the new device ID. The old device loses access (good for security).
2. **Web vs Native**: Same device ID strategy works — UUID generated per origin/installation.
3. **JWT complexity**: Including deviceId in the JWT means the experiences endpoint needs deviceId before signing. This works because the device ID is sent as a header on every request.
4. **Migration**: Old clients without device ID → free experiences work, paid ones show `audioUrl: null`. The mobile `usePurchase` hook already handles this case (shows payment prompt). No crash risk.
