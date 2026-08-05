# Design — api-observability-logs

Status: designed
Change: `api-observability-logs`
Date: 2026-08-05

## Summary

Documentation + configuration traceability change. The implementation (Wrangler observability config + redaction doc) is already applied and committed in `feat/api-log-redaction`. This design records the intended end-state the spec should pin.

## Part A — Wrangler observability configuration

Target state for `apps/api/wrangler.toml` (prod) and `apps/api/wrangler.staging.toml` (staging):

```toml
[observability]
enabled = true
head_sampling_rate = 1

[observability.logs]
enabled = true
invocation_logs = true

[observability.traces]
enabled = true
head_sampling_rate = 1
```

### Design decisions

1. **Master flag required for persistence.** `[observability] enabled = true` is the flag that controls whether logs are persisted to the Cloudflare dashboard. Verified empirically: with only the `logs` block, the Worker settings API returns `observability.enabled: false` and the dashboard Logs view is empty even though `wrangler tail` streams fine. The spec MUST state this so future maintainers don't regress to the non-persisting config.
2. **`invocation_logs = true`** keeps per-invocation log capture enabled (used by dashboard invocation log views).
3. **`head_sampling_rate = 1`** samples everything — appropriate for a low-traffic internal API; the default is also 1, kept explicit for clarity.
4. **Both environments identical** — no asymmetry between staging and prod.

## Part B — API log redaction documentation

Target state: `docs/api_logging_redaction.md` + README link.

### Doc structure

1. Problem statement (what leaked before issue #392).
2. Single source of truth: `apps/api/src/lib/log-redaction.ts` with the four primitives and allowlists table.
3. Request-side flow: middleware `customLogger` — sanitize URL, allowlist headers/query, clone-and-extract safe body fields; mermaid flowchart.
4. Response-side flow: buffer once → extract safe fields → rebuild `new Response(bodyBytes, c.res)`; byte-identical for the real client; mermaid flowchart.
5. Query-string handling (double protection: sanitized URL + query allowlist).
6. Payment routes/webhook metadata (presence flags, name-only errors).
7. HttpClient outbound policy.
8. Toggle semantics (`ENABLE_API_LOGGING !== 'false'`; redaction unconditional when enabled).
9. Invariant + enforcing test files.

### Design decisions

1. Follows the `docs/payment_flow_architecture.md` convention (mermaid + prose, English).
2. README `Documentation` section links the doc — keeps the docs index current.
3. Written in English per repo convention (all docs are English).

## Risks

- **R-A (resolved):** none material — no code touched.
- The Cloudflare dashboard persistence gap is a platform issue (issue #394), not a design risk here.
