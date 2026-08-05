# Delta for api

## ADDED Requirements

### Requirement: Workers Observability configuration

The API Worker MUST declare the full Cloudflare Workers Observability stack in its Wrangler configuration (`apps/api/wrangler.toml` for production, `apps/api/wrangler.staging.toml` for staging):

- The master flag `[observability] enabled = true` MUST be present — this is the flag that controls persistence of logs to the Cloudflare dashboard. Setting only `[observability.logs] enabled = true` without the master flag results in `observability.enabled = false` at the Worker API level and logs NOT being persisted to the dashboard (tail/real-time streaming still works).
- `[observability.logs]` MUST enable log collection (`enabled = true`) and MAY set `invocation_logs = true`.
- `[observability.traces]` MUST enable tracing (`enabled = true`) and MAY set a `head_sampling_rate` (default 1 = sample everything).

#### Scenario: master flag present persists dashboard logs

- GIVEN a Worker deployed with `[observability] enabled = true` in its Wrangler config
- WHEN the Worker settings are inspected via the Cloudflare API (`/workers/scripts/{name}/settings`)
- THEN `observability.enabled` is `true`
- AND the Cloudflare dashboard shows persisted logs for recent requests in the Observability → Logs view

#### Scenario: only logs block present does not persist dashboard logs

- GIVEN a Worker deployed with only `[observability.logs] enabled = true` (no master `[observability]` block)
- WHEN the Worker settings are inspected via the Cloudflare API
- THEN `observability.enabled` is `false` even though `observability.logs.enabled` is `true`
- AND `wrangler tail` still streams logs in real time, but the dashboard Logs view is empty

### Requirement: API log redaction documentation

The repository MUST document the API log-redaction flow in `docs/api_logging_redaction.md`, covering:

- The single source of truth: `apps/api/src/lib/log-redaction.ts` (header/query/body allowlists, `sanitizeUrl`).
- The request-side flow (middleware `apps/api/src/middleware/logger.ts`): sanitize URL, allowlist headers/query, clone-and-extract safe body fields.
- The response-side flow: buffer exactly once, extract safe body fields, rebuild with `new Response(bodyBytes, c.res)` (byte-identical for the real client).
- The `ENABLE_API_LOGGING` toggle semantics (`!== 'false'` → enabled by default; `'false'` → no buffering/logging).
- The invariant that sensitive data never appears in logged output, with the test files that enforce it.

The README MUST link this document from its Documentation section.

#### Scenario: README links the redaction doc

- GIVEN the repository README
- WHEN reading the Documentation section
- THEN it includes a link to `docs/api_logging_redaction.md`

#### Scenario: doc describes the response rebuild

- GIVEN `docs/api_logging_redaction.md`
- WHEN reading the response-side flow section
- THEN it states that the response body is buffered once and rebuilt with `new Response(bodyBytes, c.res)` preserving status/headers and exact bytes for the real client
