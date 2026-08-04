# Archive Report: API Log Redaction

**Archived**: 2026-08-04
**Change**: `api-log-redaction` — Component: `apps/api` (Bun, Hono, Vitest 4.1.10, Cloudflare Workers)
**Repo**: `/var/home/masch/dev/js/sonora` (hybrid artifact store; `openspec/` file side authoritative + Engram topic `sdd/api-log-redaction/archive-report`)
**From**: `openspec/changes/api-log-redaction/` (on branch `feat/api-log-redaction`, commit `5187153`)
**To**: `openspec/changes/archive/2026-08-04-api-log-redaction/` — **deferred to post-PR** (see Archive Snapshot; parent-owned move, PR #392 pending)

## Status

**success** — SDD cycle complete and closed. Verification PASS 9/9, sync complete, canonical spec merged, delivery committed by user approval (native review disabled), no open blockers.

## Final Outcome Summary

The change stops sensitive data — auth headers, full request/response bodies, query strings, redirect URLs, and webhook metadata objects — from persisting to Cloudflare Workers Logs (7-day retention) across **all** `apps/api` logging surfaces, via a single shared redaction policy:

- **New shared helper** `apps/api/src/lib/log-redaction.ts` (+93): `sanitizeUrl`, `sanitizeHeaders`, `sanitizeQuery`, `extractSafeBodyFields`; `HEADER_ALLOWLIST` {content-type, user-agent, x-request-id}, `QUERY_ALLOWLIST` {page, limit, sync}, `BODY_FIELD_ALLOWLIST` (locked 7-field set: purchaseId, status, event, providerPaymentId, merchant_order_id, externalReference, type), `UNPARSEABLE_URL`/`UNPARSEABLE_BODY` markers. Sole source of truth — no ad-hoc redaction at call sites.
- **Middleware rewrite** `src/middleware/logger.ts`: request/response logs emit query-stripped URLs + allowlisted headers/query/body fields only; malformed JSON → omit marker (never raw text); JSON-only response buffering with byte-identical `new Response(bodyBytes, c.res)` rebuild (real-node-server stream test preserved); warn paths embed sanitized URLs + name-only error args; `ENABLE_API_LOGGING !== 'false'` gate preserved (ON by default).
- **Payments transformations** `src/routes/payments.ts`: all 9 sensitive call sites redacted (redirect/target URLs query-stripped, webhook `existingMeta`/`incomingMeta`/`mergedMetadata` → presence flags, purchase metadata → `hasMetadata` flag, raw `Referer` never logged), plus name-only error args on the 2 origin-parse warns. Deliberately untouched: duplicate-notification / invalid-transition / missing-external_reference logs and the 2 internal raw-error paths (R-M2).
- **HttpClient log-only redaction** `src/lib/http-client.ts`: no merged headers, no request body, no response text; message/error URLs query-stripped. Network behavior untouched.
- **Unchanged as mandated**: `src/payments/mercadopago.ts` invalid-signature warn (lines 93–98) byte-for-byte; `mercadopago.test.ts`, `payments.test.ts` unmodified.

**Commit / branch**: `5187153` `feat(api): redact API logging to prevent sensitive data leaks` on branch `feat/api-log-redaction` — 17 files +2691/−85 (8 code + 8 SDD artifacts + canonical spec). `main` reset to `origin/main` (`ee3ee44`) — clean. PR pending from `feat/api-log-redaction` (issue #392).

**Test evidence**: full suite **40 files / 455 tests green** (exit 0); `make api-typecheck` clean; eslint clean on changed files. Focused: 20/20 (helper) + 17/17 (middleware) + 14/14 (http-client) + 4/4 (payments-redaction). Strict TDD compliance 6/6.

## Verification Summary

**PASS — 9/9 requirements verified** (per-requirement evidence in verify-report):

| #   | Requirement                                     | Verdict  |
| --- | ----------------------------------------------- | -------- |
| 1   | Shared log redaction helper                     | **PASS** |
| 2   | Middleware request log redaction                | **PASS** |
| 3   | Middleware response log redaction               | **PASS** |
| 4   | Query parameter allowlist                       | **PASS** |
| 5   | Sensitive data never appears in logged output   | **PASS** |
| 6   | ENABLE_API_LOGGING toggle semantics             | **PASS** |
| 7   | Payment redirect and webhook metadata redaction | **PASS** |
| 8   | HttpClient outbound log redaction               | **PASS** |
| 9   | Invalid-signature warn log unchanged            | **PASS** |

- **WARNING-1 (RESOLVED 2026-08-04)**: R7 surfaces lacked dedicated automated tests (coverage by diff inspection only). Closed by new `apps/api/src/__tests__/payments-redaction.test.ts` — 4 regression tests (create `receivedRedirectUrl` query-strip, webhook presence flags + PII absence, return redirect `rawRedirectUrl`/`finalTargetUrl` query-strip, referer-origin fallback without raw header). 4/4 green; full suite re-ran **40 files / 455 tests** green; typecheck clean.
- No CRITICAL / FAIL / BLOCKED / unresolved verification blockers.

## Delivery Disposition

**`disabled/unmanaged`** — native review kill switch is OFF (`gentle-ai review mode` disabled); no native review receipt exists (`receipt.status: not_applicable`; `next_transition: review.start` never executed). The commit `5187153` was created with **explicit user approval** on the feature branch (repo convention per AGENTS.md forbids commits on main). No receipt, no native review gate — delivery is user-owned and unmanaged. Archive creates/pushes nothing.

**Deferred parent action reconciled**: the sole unchecked tasks row (`Start or reuse bounded review of the frozen candidate…` `<!-- sdd-owner: parent -->`) is a parent-owned post-apply lifecycle action, not implementation work. Per the Archive Final-State Handoff, it is complete: user approved the commit without native review (kill switch off → no receipt required), commit `5187153` created. No stale-checkbox reconciliation needed (10/10 implementation rows already `[x]` in the persisted tasks artifact).

## Archive Snapshot

| Artifact           | File (branch `feat/api-log-redaction`)                 | Engram observation                                |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------- |
| Exploration        | `openspec/changes/api-log-redaction/explore.md`        | #955 (`sdd/api-log-redaction/explore`)            |
| Proposal           | `openspec/changes/api-log-redaction/proposal.md`       | #956 (`sdd/api-log-redaction/proposal`)           |
| Spec (delta, api)  | `openspec/changes/api-log-redaction/specs/api/spec.md` | #957 (`sdd/api-log-redaction/spec`)               |
| Design             | `openspec/changes/api-log-redaction/design.md`         | #958 (`sdd/api-log-redaction/design`)             |
| Tasks              | `openspec/changes/api-log-redaction/tasks.md`          | #960 (`sdd/api-log-redaction/tasks`)              |
| Apply Progress     | `openspec/changes/api-log-redaction/apply-progress.md` | #961 (`sdd/api-log-redaction/apply-progress`)     |
| Verify Report      | `openspec/changes/api-log-redaction/verify-report.md`  | #962 (`sdd/api-log-redaction/verify-report`)      |
| Sync Report        | `openspec/changes/api-log-redaction/sync-report.md`    | #963 (`sdd/api-log-redaction/sync-report`)        |
| **Archive Report** | `openspec/changes/api-log-redaction/archive-report.md` | **#965** (`sdd/api-log-redaction/archive-report`) |

**Canonical spec state**: `openspec/specs/api/spec.md` — **12 → 21 requirements** (9 ADDED appended; 574 lines; no MODIFIED/REMOVED/RENAMED; no destructive ops; no approval required). Verified: no duplicate requirement names; `# API Specification` → `## Requirements` structure intact.

**ADDED requirements (9)** — synced from change delta:

1. Shared log redaction helper
2. Middleware request log redaction
3. Middleware response log redaction
4. Query parameter allowlist
5. Sensitive data never appears in logged output
6. ENABLE_API_LOGGING toggle semantics
7. Payment redirect and webhook metadata redaction
8. HttpClient outbound log redaction
9. Invalid-signature warn log unchanged

**Same-domain collisions**: none — no other active change under `openspec/changes/*/specs/api/spec.md`.

**Archived path / move disposition**: per the archive mission (only the archive-report artifact is written; no git operations, no PRs, no code changes), the change folder **stays** at `openspec/changes/api-log-redaction/` on branch `feat/api-log-redaction` while PR #392 is open. The physical move to `openspec/changes/archive/2026-08-04-api-log-redaction/` is **parent-owned, post-merge** — must preserve the audit trail; never delete or silently modify archived changes.

## Structured Status / actionContext Findings

```yaml
schemaName: spec-driven
changeName: api-log-redaction
artifactStore: both # hybrid; openspec/ directory exists → file side authoritative
changeRoot: openspec/changes/api-log-redaction
artifacts: proposal done | specs done | design done | tasks done | applyProgress done | verifyReport done | syncReport done
taskProgress: total 10 | complete 10 | remaining 0 | unchecked []
deferredParentActions: total 1 | complete 1 (commit 5187153, user-approved) | remaining 0
taskArtifactErrors: []
applyState: all_done
dependencies: apply all_done | verify all_done | sync ready | archive ready
actionContext:
  mode: repo-local # no workspace-planning constraints observed
  workspaceRoot: /var/home/masch/dev/js/sonora
  allowedEditRoots: []
  warnings: []
nextRecommended: none (change closed)
isNonAuthoritative: false
```

- Status contract consumed from global `~/.pi/agent/gentle-ai/support/sdd-status-contract.md` (project override `.pi/gentle-ai/support/sdd-status-contract.md` absent).
- `openspec/config.yaml`: artifact_store hybrid, strict_tdd true, coverage false; no `rules:` key — no additional archive rules to apply.
- No destructive merge approvals needed (all-ADDED delta).

## Follow-ups (non-blocking, informational)

1. **SUGGESTION-1** — Toggle test asserts only `logger.info`; spec scenario says "no log call (info, warn, or error)". Implementation is genuinely silent when off (early return wraps all logging/buffering), so compliant; assertion could be strengthened to also assert `warn`/`error` not called. Kept byte-for-byte per locked instruction.
2. **SUGGESTION-2** — No explicit non-'false' toggle test (`ENABLE_API_LOGGING: 'true'`); default-on proven implicitly by all other middleware tests.
3. **SUGGESTION-3** — Coverage tooling not configured (`coverage: false`); changed-file coverage analysis skipped.
4. **WARNING residual (non-blocking)** — A dedicated assertion for the return-load log line (`foundPurchase`/`hasMetadata` flags) can be added later if desired; the surfaces are covered indirectly by `payments-redaction.test.ts`'s other tests.
5. **Operational** — Pre-existing pg-pool "Connection terminated unexpectedly" teardown noise is unrelated to this change (exit 0 confirmed). Old sensitive logs expire via Workers Logs 7-day retention; no retroactive purge performed (out of scope per proposal).

## Historical Note

This change (issue #392) closes the API's sensitive-data logging leak: the middleware was logging full request URLs with query strings (device IDs, signed audio URLs, emails), all headers (Authorization, Cookie, X-Api-Key, X-Device-Id), full parsed bodies, and full response bodies (signed/checkout URLs, tokens) to Cloudflare Workers Logs with 7-day retention. The shared redaction helper in `apps/api/src/lib/log-redaction.ts` is now the canonical policy source for API logging and aligns with the #390 sensitive-data policy (the repo has no OpenTelemetry counterpart; the helper IS the policy artifact). Notable operational facts for future maintainers: `ENABLE_API_LOGGING !== 'false'` is ON by default with redaction unconditional whenever enabled; the invalid-signature warn in `mercadopago.ts` is a spec-sanctioned byte-for-byte exception; `HttpClient` has zero production call sites (MercadoPago traffic uses the official SDK) — its redaction is policy consistency, not a live-leak fix; the sandbox lifecycle guard requires an approved review receipt for commits, which caused per-work-unit commits to be deferred and ultimately replaced by the single user-approved commit `5187153`; Engram HTTP was briefly unreachable during apply, and the apply-progress topic was back-filled by the parent. Delivery of this change proceeded without native review because the receipt-driven-development kill switch was off — the user owns that disposition.

## Verification Checklist

- [x] Verify report read before archiving — PASS 9/9, WARNING-1 RESOLVED, no FAIL/BLOCKED/CRITICAL
- [x] Sync report present and SYNCED (canonical merged 12 → 21 requirements)
- [x] Persisted tasks artifact re-read — 10/10 implementation rows `[x]`; no unchecked implementation markers remain
- [x] No legacy flat `spec.md` (domain specs dir present)
- [x] No destructive canonical merge (all ADDED)
- [x] Archive report written to file (`openspec/changes/api-log-redaction/archive-report.md`) and Engram (#965)
- [x] No git mutation, no PR creation, no code modification (per mission)
