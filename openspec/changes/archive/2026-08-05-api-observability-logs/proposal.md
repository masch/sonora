# Proposal: API Observability & Logging Docs

Status: proposed
Change: `api-observability-logs`
Component: `apps/api` (Expo SDK 56 monorepo, Bun, Hono Workers)

## Intent

Enable the full Cloudflare **Workers Observability** stack (persisted logs + traces) on both the staging and production API Workers, and document the API log-redaction flow in the project docs.

**Important context:** this is a **documentation + configuration traceability change only**. The observability config (`[observability]`, `[observability.logs]`, `[observability.traces]`) and the redaction-flow doc are **already applied and committed** in the current branch (`feat/api-log-redaction`). This SDD change exists to (1) record the intended behavior as canonical spec requirements, and (2) archive the work cleanly following the project convention. No new code is introduced by this change.

## Business problem

- The API redaction work (issue #392) shipped, but the **observability configuration itself had no spec** — after an earlier archive, the `[observability]` master flag (needed for dashboard log persistence) and the redaction-flow documentation were added without being captured in `openspec/specs/api/spec.md`.
- We observed that Cloudflare's dashboard **did not persist logs** until the master `observability.enabled = true` flag was applied via API, separate from `observability.logs.enabled`. This nuance is easy to get wrong and worth pinning in the spec.
- The API log-redaction flow (allowlists, buffer-and-rebuild, query stripping) was undocumented at the project level.

## Proposal

1. In `apps/api/wrangler.staging.toml` and `apps/api/wrangler.toml`: ensure the full observability stack is configured — master `[observability] enabled = true`, `[observability.logs]` (persist), and `[observability.traces]`.
2. Add `docs/api_logging_redaction.md` documenting the request/response redaction flow, and link it from the README.
3. Capture these as spec requirements in the canonical `openspec/specs/api/spec.md`.

## Out of scope

- Any code change to the redaction logic (already shipped and verified, 9/9 PASS in the sibling change).
- Deploying to production — covered by the existing deploy pipeline when the branch merges to `main`.
- Reporting the dashboard/persistence issue to Cloudflare (tracked separately).
