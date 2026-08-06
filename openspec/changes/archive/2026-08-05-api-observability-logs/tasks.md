# Tasks — api-observability-logs

Status: complete
Change: `api-observability-logs`
Date: 2026-08-05

> Implementation already applied before this change was created (committed in `feat/api-log-redaction`). All tasks are marked complete reflecting the already-shipped state.

## Work Unit 1 — Wrangler observability config (already applied)

- [x] Add `[observability]` master block with `enabled = true` and `head_sampling_rate = 1` to `apps/api/wrangler.toml` and `apps/api/wrangler.staging.toml`.
- [x] Verify `[observability.logs]` block (`enabled = true`, `invocation_logs = true`) is present in both files.
- [x] Verify `[observability.traces]` block (`enabled = true`, `head_sampling_rate = 1`) is present in both files.
- [x] Validate both TOML files parse via `wrangler deploy --dry-run` (exits cleanly).

## Work Unit 2 — Redaction documentation (already applied)

- [x] Write `docs/api_logging_redaction.md` covering the single source of truth, request/response flows, query handling, payment routes/webhook metadata, HttpClient, toggle, and invariant.
- [x] Add the doc link to the README `Documentation` section.

## Work Unit 3 — Spec + archive (this change)

- [x] Write proposal.md.
- [x] Write delta spec `specs/api/spec.md` with 2 ADDED requirements.
- [x] Merge delta into canonical `openspec/specs/api/spec.md` (21 → 23 requirements, non-destructive).
- [x] Write sync-report.md and archive-report.md.
- [x] Move change into `openspec/changes/archive/2026-08-05-api-observability-logs/` and commit in `feat/api-log-redaction`.

## Verification notes

- No code modified by this change (config + doc already shipped).
- Canonical requirement count verified: 23 after merge.
- Committed via `docs(openspec): archive api-observability-logs change and merge spec (21 to 23)`.
