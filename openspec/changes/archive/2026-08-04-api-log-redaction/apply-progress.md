# Apply Progress — api-log-redaction

Change: `api-log-redaction` — Component: `apps/api` (Bun, Hono, Vitest 4.1.10)
Repo: `/var/home/masch/dev/js/sonora` (R-7 respected; session cwd scaffold untouched)
Strict TDD: ACTIVE (project override `.pi/gentle-ai/support/strict-tdd.md` read; global module consulted — project-local file does not exist, global `~/.pi/agent/gentle-ai/support/strict-tdd.md` is the active guidance)
Delivery decision: SINGLE PR with explicit size exception (user, 2026-08-04); chain N/A.

## Structured status consumed

- Artifact store: `hybrid` (`openspec/config.yaml`), strict_tdd: true.
- Task list: `openspec/changes/api-log-redaction/tasks.md` — 11 tasks, 5 Work Units, all implementation-owned rows marked with `<!-- sdd-owner: implementation -->`; 1 parent-owned row (`<!-- sdd-owner: parent -->`, post-apply review).
- Review Workload Guard: `Decision needed before apply: Yes`, `Chained PRs recommended: Yes`, `400-line budget risk: High` — **resolved** by the recorded user delivery decision (SINGLE PR + explicit size exception) carried in the tasks artifact and the delegation prompt. No new delivery prompt required.
- Native status (`gentle-ai review status --contract gentle-ai.review-integration/v2 --next-transition`): `applicability: unrelated`, `receipt.status: not_applicable`, `next_transition: review.start` (fresh target). Starting review is parent-owned (bounded review) — sdd-apply did NOT start it.
- `actionContext` warnings: none blocking. Commit gate: the sandbox's lifecycle guard refuses `git commit` without an approved receipt (see deviation below).

## Summary

All 10 implementation tasks across Work Units 1–5 completed and checked `[x]` in the persisted tasks artifact. Full regression: `make api-test` 39 files / 451 tests green (exit 0), `make api-typecheck` clean (exit 0), eslint on all changed files clean.

### Work Unit 1 — Shared redaction helper (DONE)

- RED: `apps/api/src/lib/__tests__/log-redaction.test.ts` (20 tests) written first → module-not-found (RED confirmed).
- GREEN: `apps/api/src/lib/log-redaction.ts` — `HEADER_ALLOWLIST`, `QUERY_ALLOWLIST`, `BODY_FIELD_ALLOWLIST` (locked 7-field set), `UNPARSEABLE_URL`, `UNPARSEABLE_BODY`, `sanitizeUrl`, `sanitizeHeaders`, `extractSafeBodyFields`, `sanitizeQuery` exactly per design §4. 20/20 green.
- Triangulation embedded in RED tests (multi-case per behavior); no refactor needed (clean).

### Work Unit 2 — Middleware redesign (DONE)

- RED: `apps/api/src/middleware/__tests__/logger.test.ts` rewritten per design §8.2 → 15 failed / 2 passed against old middleware (the 2 passes = toggle test + real-node-server byte-identity test, kept). Added sensitive-payload variant to the real-server test and the full negative-invariant battery.
- GREEN: `apps/api/src/middleware/logger.ts` rewritten per design §5 (D1 absolute query-stripped message URLs; D2 toggle gate wraps all buffering; D3 JSON-only response buffering with `new Response(bodyBytes, c.res)` rebuild; D4 name-only error args). 17/17 green.
- Middleware is mounted globally — full `make api-test` re-run after U2: 39 files / 448 tests green (exit 0). Pre-existing pg-pool "Connection terminated unexpectedly" noise in some runs is an unrelated teardown artifact; exit code 0.

### Work Unit 3 — payments.ts call-site transformations (DONE)

- All 9 call-site transformations per design §6 + name-only error args on the 2 `Failed to parse request URL origin…` warns. `sanitizeUrl` imported from `../lib/log-redaction` (placed in correct import order).
- Deliberately untouched surfaces verified: duplicate-notification / invalid-transition / missing-external_reference logs, `Active payment status fallback check failed:` and `Failed to read purchase metadata` raw-error paths (R-M2).
- Approval-based (refactor with no behavior change): `payments.test.ts` 25/25 still green after transformation.

### Work Unit 4 — HttpClient log redaction (DONE)

- RED: `apps/api/src/__tests__/http-client.test.ts` — added top-level `vi.mock('@sonora/shared')` logger mock, `vi.clearAllMocks()` in beforeEach, `serializedLogs()` helper, and 3 negative tests per design §8.3 → exactly 3 failed / 11 passed (RED confirmed; existing behavioral tests unaffected).
- GREEN: `apps/api/src/lib/http-client.ts` log-only changes per design §7 (request log headers allowlisted + body never logged; response log status-only; response-text warn name-only; error log query-stripped URL + `{ error, status }`). 14/14 green.

### Work Unit 5 — Invariant sweep / regression gates (DONE)

- `git diff apps/api/src/payments/mercadopago.ts` → zero hunks (byte-for-byte unchanged, invalid-signature warn lines 93–98 intact); `mercadopago.test.ts` untouched and passing.
- `payments.test.ts` audit: logger spies are `mockImplementation` no-ops; the only two spy assertions target deliberately-untouched logs (`[WEBHOOK] Duplicate notification` message prefix; `[METRIC:invalid_webhook_transition_total]` metadata `from`/`attempted`). **No payload-dependent assertion on sanitized surfaces — file left unmodified** (predicted no-op confirmed).
- Full gates: `make api-test` 39 files / 451 tests (exit 0); `make api-typecheck` clean (exit 0); eslint clean on all changed files.
- Negative sweep: all 8 markers (`supersecret-token`, `supersecret-session`, `signedsecret`, `deviceId=abc123`, `outbound-secret`, `client_secret=abc`, `buyer@example.com`, `token=abc`) asserted absent via `serializedLogs()` / helper-unit assertions, plus extra invariants (`checkoutUrl`, `jwt-abc`, `data.id`, `{invalid-json`, `masch`, `token123`, `token=secret`).

## Files changed

| File                                               | Change                                                    |
| -------------------------------------------------- | --------------------------------------------------------- |
| `apps/api/src/lib/log-redaction.ts`                | **new** — helper + allowlist constants                    |
| `apps/api/src/lib/__tests__/log-redaction.test.ts` | **new** — 20 unit tests                                   |
| `apps/api/src/middleware/logger.ts`                | redesign (design §5)                                      |
| `apps/api/src/middleware/__tests__/logger.test.ts` | rewrite + negative invariants + stream variant (17 tests) |
| `apps/api/src/routes/payments.ts`                  | 9 transformations + 2 warn consistency edits (design §6)  |
| `apps/api/src/lib/http-client.ts`                  | log-only redaction (design §7)                            |
| `apps/api/src/__tests__/http-client.test.ts`       | logger mock + 3 negative tests (14 tests)                 |
| `apps/api/src/payments/mercadopago.ts`             | **no change** (byte-for-byte)                             |
| `apps/api/src/__tests__/mercadopago.test.ts`       | **no change**                                             |
| `apps/api/src/__tests__/payments.test.ts`          | **no change** (audit no-op)                               |

## Test commands run

- `cd apps/api && bun run test src/lib/__tests__/log-redaction.test.ts` → RED: module-not-found; GREEN: 20/20.
- `cd apps/api && bun run test src/middleware/__tests__/logger.test.ts` → RED: 15 failed/2 passed; GREEN: 17/17 (re-run after typecheck fix: 17/17).
- `cd apps/api && bun run test src/__tests__/http-client.test.ts` → RED: 3 failed/11 passed; GREEN: 14/14.
- `cd apps/api && bun run test src/__tests__/payments.test.ts` → 25/25 after U3 (approval).
- `make api-test` (root) → 39 files / 448 tests (after U2), 451 tests (final; +3 http-client). exit 0.
- `make api-typecheck` → clean (exit 0). One fix cycle: `logMeta` helper typed with `Mock<(message: string, meta: unknown) => void>` + call sites wrapped in `vi.mocked(logger.info)`.
- `cd apps/api && bunx eslint <7 changed files>` → clean (exit 0).

### TDD Cycle Evidence

| Task         | Test File                                 | Layer                  | Safety Net          | RED                               | GREEN                        | TRIANGULATE                     | REFACTOR               |
| ------------ | ----------------------------------------- | ---------------------- | ------------------- | --------------------------------- | ---------------------------- | ------------------------------- | ---------------------- |
| U1 RED+GREEN | `src/lib/__tests__/log-redaction.test.ts` | Unit                   | N/A (new)           | ✅ Written (module-not-found)     | ✅ 20/20                     | ✅ 7–9 cases per function       | ➖ None needed (clean) |
| U2 RED+GREEN | `src/middleware/__tests__/logger.test.ts` | Integration (Hono app) | ✅ 8/8 pre-change   | ✅ Written (15 failed)            | ✅ 17/17                     | ✅ positive+negative invariants | ➖ None needed         |
| U3 transform | `src/__tests__/payments.test.ts`          | Integration            | ✅ 25/25            | ✅ (approval: no behavior change) | ✅ 25/25                     | N/A (locked transformation)     | ➖ None needed         |
| U4 RED+GREEN | `src/__tests__/http-client.test.ts`       | Unit                   | ✅ 11/11 pre-change | ✅ Written (3 failed)             | ✅ 14/14                     | ✅ 3 distinct paths             | ➖ None needed         |
| U5 sweep     | — (gates)                                 | —                      | ✅ 448 → 451        | N/A                               | ✅ make api-test + typecheck | —                               | —                      |

### Test Summary

- **Total tests written**: 23 new (20 helper + 3 http-client); middleware file rewritten 8 → 17.
- **Total tests passing**: 451 across 39 files (final `make api-test`, exit 0).
- **Layers used**: Unit (helper + http-client), Integration (middleware Hono app tests, payments approval).
- **Approval tests** (refactoring): payments.test.ts 25/25 preserved; mercadopago.test.ts untouched.
- **Pure functions created**: 4 (`sanitizeUrl`, `sanitizeHeaders`, `extractSafeBodyFields`, `sanitizeQuery`).

## Deviations from design/task text

1. **Per-work-unit commits NOT created.** Task text requested separate conventional commits per Work Unit; the sandbox lifecycle guard refuses `git commit` (even `--dry-run`) without an approved review receipt ("Run one direct lifecycle command with its approved receipt and exact typed target"). Native review status shows `receipt.status: not_applicable` and `next_transition: review.start`, which is parent-owned (sdd-apply must not start bounded review). Work is staged in the index as the single PR candidate (delivery decision: one PR). **Action for parent:** after review approval, create the receipt and run the per-unit commits (U1 = helper, U2 = middleware, U3 = payments, U4 = http-client, U5 = sweep) or a single squashed conventional commit, e.g. `feat(api): redact API logging`.
2. `logs POST requests with valid JSON body` response assertion: design §8.2 says "response body extraction likewise"; the test route returns `{ received: {...} }` which has no allowlisted top-level keys, so the response metadata body is asserted as `{}` (real extraction result, triangulated by the sensitive-response test asserting `{ providerPaymentId, status }`).
3. Toggle test (`ENABLE_API_LOGGING: 'false'`) kept byte-for-byte unchanged per locked instruction; spec scenario wording ("no log call (info, warn, or error)") is a strengthening beyond the current info-only assertion — no contradiction, so kept as instructed.
4. Helper `sanitizeUrl` empty-string branch uses `if (!url) return ''` (design §4 shows `if (!url) return ''`); `undefined` coerce is defensive for the `redirectUrl ? sanitizeUrl(redirectUrl) : undefined` call pattern.

## Remaining tasks (persisted artifact, unchecked)

- `- [ ] Start or reuse bounded review of the frozen candidate (expects chained PRs; apply must stage PR 1 = Work Unit 1, PR 2 = Work Unit 2, PR 3 = Work Units 3–5). <!-- sdd-owner: parent -->`

## Workload / PR boundary

Single PR candidate staged in the index (7 code files). Estimated changed lines: ~+560/−215 (new helper 93, helper tests 180, middleware rewrite ~85/−115, logger tests +160/−120, payments +40/−25, http-client +30/−25, http-client tests +95/−5) — inside the user-approved size exception. Per-unit commit boundaries: U1 `apps/api/src/lib/{log-redaction.ts,__tests__/log-redaction.test.ts}`; U2 `apps/api/src/middleware/{logger.ts,__tests__/logger.test.ts}`; U3 `apps/api/src/routes/payments.ts`; U4 `apps/api/src/lib/http-client.ts` + `src/__tests__/http-client.test.ts`; U5 sweep (no file changes to mercadopago/payments suites).

## Post-verify addition (2026-08-04, parent — WARNING-1 closure)

After verify reported WARNING-1 (R7 payments redaction surfaces had no dedicated automated tests), the user opted to close it before review. Added `apps/api/src/__tests__/payments-redaction.test.ts` (4 regression tests: create `receivedRedirectUrl` query-strip, webhook metadata presence flags + PII absence, return redirect `rawRedirectUrl`/`finalTargetUrl` query-strip, referer-origin fallback without raw header). 4/4 green; full suite re-ran 40 files / 455 tests green (exit 0); typecheck clean. File staged; candidate now 8 files (+860/−99). Verify-report updated (WARNING-1 RESOLVED).

## Risks

- Engram persistence: `mem_save`/`mem_search` failed at session start (Engram HTTP server unreachable at 127.0.0.1:7437). Apply-progress is persisted to `openspec/changes/api-log-redaction/apply-progress.md` (hybrid store file side); a final `mem_save` retry is attempted. If it still fails, the engram topic `sdd/api-log-redaction/apply-progress` must be back-filled by the parent.
- pg-pool "Connection terminated unexpectedly" noise appears in some full-suite runs (unrelated teardown; exit 0). Verify phase should confirm it is pre-existing.
- Commits deferred to parent gate (see deviations) — the frozen candidate lives in the index + working tree only.
