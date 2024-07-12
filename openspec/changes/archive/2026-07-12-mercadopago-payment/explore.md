# SDD Explore: MercadoPago Payment Integration

**Change**: `mercadopago-payment`
**Date**: 2026-07-11
**Status**: completed

## Project Context

Sonora is an Expo SDK 56 universal app (iOS, Android, Web) using Expo Router, NativeWind v5, Bun, Hono backend, Drizzle ORM, PostgreSQL (Neon).

## Current Data Model

### Shared types (`packages/shared/src/experiences.ts`)

- `BaseExperience` has `priceLabel?: string | null` — display-only text, no payment logic
- Experience types: `TrackExperience` (format: 'track'), `TripExperience` (format: 'trip'), `GeneralFeedbackExperience`
- `USER_EXPERIENCE_FORMATS = ['track', 'trip']`

### DB Schema (`apps/api/src/db/schema.ts`)

- `experiences` table: id, slug, title, description, format, themeKey, audioUrl, durationSeconds, latitude, longitude, recordedAt, **priceLabel** (text, nullable), imageKey, geofenceBypassable
- No purchases table
- No auth/user system

### Seed data (`apps/api/src/db/seed.ts`)

- Trips and tracks with `priceLabel` as plain text (e.g., '15 mil $', 'FREE')
- No structured pricing

## Current Architecture

### Frontend (apps/mobile)

- **File structure**: Expo Router in `src/app/`, components in `src/components/`
- **Experience detail**: `TripDetailView` and `TrackDetailView` — show title, description, map, audio player, feedback form, download controls
- **Experience list**: `ExperiencesScreen` with format filter (track/trip)
- **API client**: `ApiClient` wraps `BaseApiClient` from `@sonora/shared`
  - Supports GET/POST/PUT/DELETE, caching via `app-storage`
  - `app-storage` has platform-specific impl (AsyncStorage mobile, localStorage web)
- **i18n**: `useAppTranslation` hook, locales in `src/i18n/locales/{es,en}.ts`

### Backend (apps/api)

- **Framework**: Hono
- **Routes**: `/health`, `/feedback`, `/themes`, `/experiences`, `/audio`, `/config`, `/api/translations`
- **`GET /experiences`**: Returns all experiences with waypoints, signed audio URLs (JWT)
- **No auth**, no user system, no payments
- **Env vars**: DATABASE_URL, JWT_SECRET, etc.

### Shared package (packages/shared)

- Base API client, experience types, feedback types, schemas, logger
- `BaseApiClient` supports auth headers, caching, transforms

## User Requirements (from clarifications)

1. Each experience has `free` flag + `price`. Configured in DB seed.
2. MercadoPago Checkout Pro (redirect-based). Backend creates preference, frontend opens MP.
3. Purchases persist via email (no full account). Enter email, purchase recorded in DB.
4. No visual distinction in list. On tap → show price + payment before playing.
5. Free experiences play immediately.
