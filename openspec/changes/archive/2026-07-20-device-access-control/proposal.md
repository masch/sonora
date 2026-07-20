# Proposal: device-access-control & staging-indicator

## Intent

Implement a device-based access control system to prevent unauthorized access to signed experience URLs, and add a clear visual indicator across all platforms (Mobile, Web, and Admin) to distinguish the staging environment from production.

## Capabilities

| Who                  | Can do                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mobile User (Paid)   | Securely streams purchased experience audio verified by their unique device ID.                            |
| Mobile User (Legacy) | Continues to stream free experiences, but receives restricted access (null audio URL) for paid ones.       |
| Developer / QA       | Instantly recognizes whether they are running/testing on a Staging or Production build via a visual badge. |

## Scope

**In scope**:

- **Database**: Add `device_id` column to `sonora.experience_accesses` table.
- **Backend API**:
  - Read `Authorization: Bearer device:<uuid>` on Hono routes.
  - Sign JWT tokens incorporating the device ID.
  - Filter GET `/experiences` audio URLs based on device-id verification (free is always open, paid requires matching `device_id`).
- **Mobile Client**:
  - Generate and persist a unique UUID v4 `device_id` locally (KV storage/localStorage).
  - Attach the device ID as a Bearer token in the `ApiClient` authorization header.
- **Visual Staging Indicator**:
  - Add a floating `StagingBadge` in `apps/mobile` (Web/Native) and `apps/admin` (Web/Native) when `isStaging` is true.

**Out of scope**:

- Complex multi-device synchronization (device ID is bound per installation/origin).
- Full user authentication/login flow for listeners (remains device/purchase-based).

## Approach

1. **Storage & Identification**:
   - Native: `expo-application` ID / fallback UUID.
   - Web: `localStorage` UUID.
2. **Security**:
   - JWT token payload contains `{ key, deviceId, exp }` signed by the backend and verified on audio stream requests.
3. **Staging Indicator**:
   - Environment detection: check `EXPO_PUBLIC_API_URL` contains `staging` or `process.env.APP_ENV === 'staging'`.
   - Render a floating badge at the top/corner of layout containers.

## Success Criteria

- [ ] Backend runs migrations successfully adding `device_id`.
- [ ] Staging badge is clearly visible in Staging mode in both `apps/mobile` and `apps/admin`.
- [ ] Requests to GET `/experiences` send the `Authorization` header with the device ID.
- [ ] Streaming paid audio without a matching device ID access record is rejected.
