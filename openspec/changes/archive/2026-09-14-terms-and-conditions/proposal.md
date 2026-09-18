# Proposal: Terms and Conditions

## Intent

Enforce user acceptance of versioned terms and conditions before accessing Sonora, tracking legal consent via an immutable server-side audit trail using a GitOps-driven versioning model.

## Scope

### In Scope

- Database table `terms_versions` for immutable versioned legal texts, selected by `ORDER BY published_at DESC LIMIT 1`.
- Database table `terms_acceptances` for append-only audit trail records (`deviceId`, `version`, `contentHash` SHA-256, `platform`, `ipAddress`, `userAgent`, `acceptedAt`).
- GitOps terms ingestion: legal texts authored in code/repository and loaded via idempotent Drizzle migrations / seed scripts (`ON CONFLICT (version) DO NOTHING`).
- Public API endpoint `GET /api/terms` returning the active terms version, title, content, and SHA-256 hash.
- Public API endpoint `POST /api/terms/accept` recording non-repudiation audit consent.
- Shared validation schemas and TypeScript types in `packages/shared`.
- Blocking mobile modal in `apps/mobile` matching `TrackDetailView` visual tokens (dark/light theme, typography, emerald primary button).
- Connection-required retry state when opening the app offline without prior acceptance.
- Local storage persistence of accepted version in SQLite KV store (`appStorage`).
- Startup check invalidating access if backend terms version is newer than the locally accepted version.

### Out of Scope

- Runtime administrative editing endpoints (updates are managed through Git PRs and deployments).
- User account authentication (Sonora identifies installations via `deviceId`).

## Capabilities

### New Capabilities

- `terms-service`: Backend Hono endpoints to query active terms and record legal acceptances.
- `terms-gate`: Mobile startup gate blocking navigation until the current terms version is accepted.

### Modified Capabilities

None

## Approach

1. **Data Model (`apps/api`)**: Define `terms_versions` (immutable documents) and `terms_acceptances` (append-only audit log) in Drizzle ORM.
2. **GitOps Seed**: Maintain terms content in repository data, inserting new versions via migration/script with `ON CONFLICT (version) DO NOTHING`.
3. **API Endpoints (`apps/api`)**: Expose `GET /api/terms` (fetches latest by `published_at DESC LIMIT 1`) and `POST /api/terms/accept` (validates with Zod, captures client IP and User-Agent headers, inserts into `terms_acceptances`).
4. **Shared Package (`packages/shared`)**: Export DTOs and Zod schemas (`TermsResponse`, `AcceptTermsRequestSchema`).
5. **Mobile (`apps/mobile`)**: Implement `useTermsCheck` hook and `TermsModal` component. Render blocking modal in `RootLayout` before unblocking tabs.

## Affected Areas

| Area                                         | Impact   | Description                                         |
| -------------------------------------------- | -------- | --------------------------------------------------- |
| `apps/api/src/db/schema.ts`                  | Modified | Add `terms_versions` and `terms_acceptances` tables |
| `apps/api/src/db/seed.ts`                    | Modified | Add initial terms version seed                      |
| `apps/api/src/routes/terms.ts`               | New      | Route handlers for GET and POST                     |
| `apps/api/src/index.ts`                      | Modified | Mount `/api/terms` router                           |
| `packages/shared/src/`                       | Modified | Export shared schemas and types                     |
| `apps/mobile/src/storage/app-storage.ts`     | Modified | Helpers for accepted terms version                  |
| `apps/mobile/src/components/terms-modal.tsx` | New      | Blocking UI styled after TrackDetailView            |
| `apps/mobile/src/hooks/use-terms-check.ts`   | New      | Terms querying, version check, and submission       |
| `apps/mobile/src/app/_layout.tsx`            | Modified | Render terms gate modal                             |

## Risks

| Risk                            | Likelihood | Mitigation                                       |
| ------------------------------- | ---------- | ------------------------------------------------ |
| Offline on initial start        | High       | Render clear retry screen with offline messaging |
| Text tampering / repudiation    | Low        | Persist SHA-256 hash alongside version in DB     |
| Flaky network during acceptance | Low        | Idempotent POST with error recovery and retry    |

## Rollback Plan

Remove `TermsModal` from `RootLayout` to immediately unblock mobile users. Revert `/api/terms` route registration. Database tables are additive.

## Dependencies

- PostgreSQL connection in `apps/api`.
- `SqliteStorage` in `apps/mobile`.

## Success Criteria

- [ ] New app installations cannot bypass the terms gate without accepting.
- [ ] Database captures audit record with device ID, version, SHA-256 hash, IP, and timestamp.
- [ ] Opening app offline without accepted terms shows a retry screen.
- [ ] Bumping terms version in backend triggers re-acceptance on next app start.
- [ ] Automated tests pass in both `apps/api` and `apps/mobile` under Strict TDD.
