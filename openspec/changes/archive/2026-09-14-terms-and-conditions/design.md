# Design: Terms and Conditions

## Technical Approach

Implement a compliance-grade legal terms gate for Sonora. Terms versions are defined in the repository and seeded into PostgreSQL via Drizzle (`terms_versions`), with the active version resolved deterministically by `ORDER BY published_at DESC LIMIT 1`. User acceptances are recorded in an append-only audit table (`terms_acceptances`) capturing `deviceId`, `version`, `contentHash` (SHA-256), `platform`, `ipAddress`, and `userAgent`.

On the mobile client, `RootLayout` invokes `useTermsCheck`. If terms are unaccepted or a newer version exists, `TermsModal` blocks access. The UI adheres strictly to `TrackDetailView` styling (`useThemeColors()`, `TwView`, `ThemedText`, rounded emerald CTA button).

## Architecture Decisions

| Decision                      | Choice                                    | Alternatives Considered          | Rationale                                                                       |
| ----------------------------- | ----------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| **Version Publication**       | GitOps-driven via code/migrations         | Dynamic CMS / Admin API endpoint | Guarantees public Git audit history; eliminates runtime authentication surface. |
| **Active Version Resolution** | `ORDER BY published_at DESC LIMIT 1`      | Boolean `active` flag            | Avoids multiple-active data anomalies without requiring partial indexes.        |
| **Audit Non-Repudiation**     | Client submits & server logs SHA-256 hash | Version number only              | Proves mathematically which exact text was displayed and accepted.              |
| **Offline First Launch**      | Strict block with Retry CTA               | Fallback bundled terms           | Strictly enforces user preference: must guarantee latest terms version.         |

## Data Flow

```
[Mobile App Startup]
       │
       ▼
Reads local accepted version from SqliteStorage
       │
       ▼
Calls GET /api/terms ────────────────────────┐
       │                                     │
       ▼                                     ▼
Remote version > Local version?        Query: ORDER BY published_at DESC LIMIT 1
   ├── NO  ──→ Dismiss gate & show tabs
   └── YES ──→ Render TermsModal (blocking)
                     │
                     ▼
             User reads & clicks "Accept"
                     │
                     ▼
             POST /api/terms/accept ─────────┐
                     │                       │
                     ▼                       ▼
             Save version in storage    INSERT into terms_acceptances
                     │                  (device_id, version, content_hash, ip, ua)
                     ▼
             Unblock & render tabs
```

## File Changes

| File                                         | Action | Description                                                 |
| -------------------------------------------- | ------ | ----------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                  | Modify | Add `termsVersions` and `termsAcceptances` tables           |
| `apps/api/src/db/seed-data.ts`               | Modify | Add base initial terms version data (v1.0.0)                |
| `apps/api/src/routes/terms.ts`               | Create | Hono route with `GET /` and `POST /accept` handlers         |
| `apps/api/src/index.ts`                      | Modify | Mount `termsRouter` at `/api/terms`                         |
| `packages/shared/src/types/terms.ts`         | Create | DTO types: `TermsResponse`, `AcceptTermsRequest`            |
| `packages/shared/src/schemas/terms.ts`       | Create | Zod validation schemas for terms endpoints                  |
| `apps/mobile/src/storage/app-storage.ts`     | Modify | Add `getAcceptedTermsVersion` and `setAcceptedTermsVersion` |
| `apps/mobile/src/hooks/use-terms-check.ts`   | Create | Hook orchestrating terms fetch, comparison, and acceptance  |
| `apps/mobile/src/components/terms-modal.tsx` | Create | Full-screen modal matching `TrackDetailView` styles         |
| `apps/mobile/src/app/_layout.tsx`            | Modify | Wire `useTermsCheck` and render `TermsModal`                |

## Interfaces / Contracts

```typescript
// packages/shared/src/types/terms.ts
export interface TermsResponse {
  version: string;
  title: string;
  content: string;
  contentHash: string;
  publishedAt: string;
}

export interface AcceptTermsRequest {
  deviceId: string;
  version: string;
  contentHash: string;
  platform: 'ios' | 'android' | 'web';
}
```

```typescript
// apps/api/src/db/schema.ts
export const termsVersions = sonoraSchema.table('terms_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  version: text('version').unique().notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
});

export const termsAcceptances = sonoraSchema.table('terms_acceptances', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: text('device_id').notNull(),
  version: text('version').notNull(),
  contentHash: text('content_hash').notNull(),
  platform: platformEnum('platform').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
});
```

## Testing Strategy

| Layer              | What to Test                                                | Approach                       |
| ------------------ | ----------------------------------------------------------- | ------------------------------ |
| Unit (API)         | `GET /api/terms` returns latest version; 404 when empty     | Vitest with mock DB            |
| Unit (API)         | `POST /api/terms/accept` validates input & captures headers | Vitest route test              |
| Unit (Mobile)      | `useTermsCheck` version comparison & offline retry state    | Jest with mock storage & fetch |
| Component (Mobile) | `TermsModal` renders content, handles scroll, fires accept  | React Native Testing Library   |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Run Drizzle schema migration (`bun db:generate` && `bun db:migrate`) and seed initial terms before mobile release.

## Open Questions

None — all architectural tradeoffs and storage decisions have been resolved.
