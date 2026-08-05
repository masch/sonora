# Archive Report — api-observability-logs

Status: ARCHIVED
Change: `api-observability-logs`
Date: 2026-08-05
Branch: `feat/api-log-redaction`

## Change Type

Documentation + configuration traceability change (no new code). The observability Wrangler config (`[observability]`/`[observability.logs]`/`[observability.traces]`) and `docs/api_logging_redaction.md` were applied and committed in the same branch before this change was created; this SDD change records the behavior as canonical spec requirements and archives the work cleanly.

## Scope Covered

- **Workers Observability configuration** — master `observability.enabled = true` flag (dashboard log persistence), `logs.enabled`, `invocation_logs`, `traces.enabled`, `head_sampling_rate` in both `apps/api/wrangler.toml` and `apps/api/wrangler.staging.toml`.
- **API log redaction documentation** — `docs/api_logging_redaction.md` (flow, allowlists, toggle, invariant) linked from the README.

## Verification

- Canonical spec merged 21 → 23 requirements (all-ADDED, non-destructive).
- Delta spec file readable at `specs/api/spec.md`.
- Sync report present and SYNCED.
- No code mutation performed by this change.

## Operational Notes

1. **Master flag nuance (verified via Cloudflare API):** `observability.enabled = true` is required for dashboard log persistence. `[observability.logs] enabled = true` alone leaves the master flag `false` at the Worker settings level — `wrangler tail` still streams, but the dashboard Logs view stays empty. Pinned as a spec scenario to prevent regression.
2. **Dashboard gap:** as of 2026-08-05 the Cloudflare dashboard shows no persisted logs for `sonora-api-staging` despite verified config (`observability.enabled=true`, `persist=true`) and live `wrangler tail` capture. Tracked in repo issue #394 and Cloudflare community thread #904412. Operational source of truth for log visibility remains `bunx wrangler tail --config wrangler.staging.toml`.
3. **Production:** `apps/api/wrangler.toml` carries the same observability config; it applies when the branch merges to `main` and the deploy pipeline runs.

## Follow-ups (non-blocking, informational)

- Confirm dashboard persistence after Cloudflare resolves the reported observability dashboard issue (issue #394).
- Optional: report the dashboard gap to Cloudflare support (standard plan) with issue #394 as reference.
