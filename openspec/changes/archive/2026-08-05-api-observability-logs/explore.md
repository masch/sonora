# Exploration — api-observability-logs

Status: explored
Change: `api-observability-logs`
Date: 2026-08-05

## Context

This is a documentation + configuration traceability change. The underlying work was **already applied** before this change was created (committed in `feat/api-log-redaction`), so exploration verified the current state rather than discovering new territory.

## Findings

### Cloudflare Workers Observability configuration

- `apps/api/wrangler.toml` (production) and `apps/api/wrangler.staging.toml` (staging) now carry the full observability stack:
  - `[observability] enabled = true` (master flag)
  - `[observability.logs] enabled = true; invocation_logs = true`
  - `[observability.traces] enabled = true; head_sampling_rate = 1`
- **Key discovery (verified via Cloudflare API):** the master flag `observability.enabled` controls dashboard log persistence. With only `[observability.logs] enabled = true`, the Worker settings API reports `observability.enabled = false` — `wrangler tail` still streams, but the dashboard Logs view stays empty. This nuance is now pinned as a spec scenario.

### API log redaction documentation

- `docs/api_logging_redaction.md` exists (7218 bytes) and documents: the single source of truth (`apps/api/src/lib/log-redaction.ts`), request-side and response-side flows (buffer-and-rebuild), the `ENABLE_API_LOGGING` toggle, allowlists, and the invariant with test files.
- README `Documentation` section links the new doc (added alongside).

### OpenSpec state

- Canonical `openspec/specs/api/spec.md` had **21 requirements**; none covered observability configuration or the redaction doc.
- The sibling change `api-log-redaction` (archived 2026-08-04) already merged the redaction _behavior_ requirements (allowlists, sanitize, toggle). This change adds the observability _config_ requirement and the _documentation_ requirement.

## Decision

Capture the observability config semantics and the doc as 2 ADDED requirements in the canonical `api` spec; archive the change with full artifact set per repo convention.

## Risks

- Low — no code changes; only spec/doc/archive files.
- The dashboard log-persistence gap (Cloudflare platform) is tracked separately (issue #394, CF community #904412) and noted in the archive report.
