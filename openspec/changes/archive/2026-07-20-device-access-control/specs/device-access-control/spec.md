# Specification: Device Access Control & Staging Indicator

## Purpose

The purpose of this specification is to:

1. Restrict signed experience URLs to the device that has purchased or been granted access.
2. Provide a distinct visual indicator on both Web and Native platforms when running in the Staging environment.

## Functional Requirements

### 1. Device Identity

- The mobile app (Web + Native) MUST generate a unique device ID (UUID v4) on first launch if not already present.
- The device ID MUST be persisted locally in the application's KV/localStorage.
- The device ID MUST be exposed to API requests.

### 2. Authorization Header

- The ApiClient MUST attach the device ID to the `Authorization` header on all backend requests in the format `Bearer device:<device-id>`.

### 3. Backend Access Control

- The backend API MUST parse the `device` bearer token.
- The `GET /experiences` endpoint MUST check the database for access records matching the `device_id` or `email` associated with the device.
- For paid experiences, if a valid access record does not exist for the device, the API MUST return `audioUrl: null`.
- Free experiences MUST always return the signed audio URL.

### 4. Visual Staging Indicator

- The frontend (Mobile and Admin apps) MUST determine if the current environment is staging.
- Environment detection MUST check if `EXPO_PUBLIC_API_URL` contains `staging` or `process.env.APP_ENV === 'staging'`.
- If the environment is staging, the UI MUST display a floating badge containing the text "STAGING" with a prominent amber background (`bg-amber-500`) at the top corner of the screen.

## Success Criteria

- Paid audio stream signatures are unique to the device ID.
- Staging builds show a persistent, readable badge.
