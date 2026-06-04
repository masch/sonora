# Archive Report: persist-feedback-db

- **Change Name**: persist-feedback-db (Issue #62)
- **Archived By**: SDD archive executor
- **Archive Date**: 2026-06-03
- **Artifact Store Mode**: hybrid (Engram + OpenSpec)
- **Delivery Strategy**: single-pr

## Verification Status

- **Result**: PASSED WITH WARNINGS
- **Critical Issues**: None
- **Verification Report**: Inline (not persisted separately to Engram)

## Change Summary

Added Postgres persistence behind the existing `POST /feedback` handler using Drizzle ORM. A dual-environment factory (`pg` Pool locally via Docker Postgres 17, `@neondatabase/serverless` HTTP on Workers) is injected via Hono `c.set('db', db)` middleware. KV stays as fast-path idempotency optimization; the Postgres `idempotency_key` UNIQUE constraint is the authoritative dedup.

### What Changed

- **New files**: `api/src/db/schema.ts`, `api/src/db/index.ts`, `api/src/server.local.ts`, `api/docker-compose.yml`, `api/drizzle.config.ts`, `api/.dev.vars`, `api/.gitignore`, `api/migrations/0000_perfect_master_mold.sql`
- **Modified files**: `api/src/index.ts`, `api/wrangler.toml`, `api/package.json`, `Makefile`, `.env_example`, `api/src/__tests__/feedback.test.ts`
- **New deps**: drizzle-orm, pg, @neondatabase/serverless, @hono/node-server (runtime); drizzle-kit, @types/node (dev)

### Implementation Stats

- **Tasks**: 9/9 completed
- **Tests**: 11 total (7 existing + 4 new), all passing
- **Typecheck**: Clean

## Specs Synced

| Domain   | Action                 | Details                                     |
| -------- | ---------------------- | ------------------------------------------- |
| feedback | Updated (delta merged) | 4 requirements added, 0 modified, 0 removed |

### Added Requirements

1. **Database Schema** — `sonora.feedback` table with unique constraint on `idempotency_key`
2. **Feedback Persistence** — Insert via Drizzle, UNIQUE violation → 409
3. **Dual-Environment Runtime** — Same code works against Docker Postgres 17 (local) and Neon (Workers)
4. **Idempotency Key Source of Truth** — DB UNIQUE constraint is authoritative; KV is fast-path optimization

### Added Scenarios

- Migration creates table
- Migration not applied (5xx)
- Accepted feedback stored
- Duplicate via UNIQUE constraint
- Local Docker Postgres
- Workers + Neon
- KV miss, DB hit
- KV hit prevents DB write

## Engram Artifact References

| Artifact       | Observation ID | Topic Key                                |
| -------------- | -------------- | ---------------------------------------- |
| Explore        | #2817          | `sdd/persist-feedback-db/explore`        |
| Proposal       | #2818          | `sdd/persist-feedback-db/proposal`       |
| Spec           | #2819          | `sdd/persist-feedback-db/spec`           |
| Design         | #2820          | `sdd/persist-feedback-db/design`         |
| Tasks          | #2822          | `sdd/persist-feedback-db/tasks`          |
| Apply Progress | #2823          | `sdd/persist-feedback-db/apply-progress` |
| Archive Report | this file      | `sdd/persist-feedback-db/archive-report` |

## Archive Contents

- exploration.md ✅
- proposal.md ✅
- spec.md ✅ (delta spec)
- design.md ✅
- tasks.md ✅ (9/9 tasks complete)
- archive-report.md ✅ (this file)

## Source of Truth Updated

- `openspec/specs/feedback/spec.md` — now reflects Postgres persistence behavior

## Notes

- Migration output directory was `./migrations/` (configured in `drizzle.config.ts`)
- Migration files are committed to version control (schema source of truth)
- Used `podman compose` for Docker targets per user preference
- `@neondatabase/serverless` requires `nodejs_compat` flag in `wrangler.toml`
- No Hyperdrive — deferred as a performance optimization
