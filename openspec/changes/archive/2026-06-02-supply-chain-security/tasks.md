# Tasks: Supply Chain Security

## Review Workload Forecast

| Field                   | Value            |
| ----------------------- | ---------------- |
| Estimated changed lines | ~35 (6 + 28 + 1) |
| 400-line budget risk    | Low              |
| Chained PRs recommended | No               |
| Suggested split         | Single PR        |
| Delivery strategy       | ask-on-risk      |
| Chain strategy          | size-exception   |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                  | Likely PR | Notes                                        |
| ---- | ----------------------------------------------------- | --------- | -------------------------------------------- |
| 1    | Create bunfig.toml + socket.yml + .env_example update | PR 1      | Single PR, all independent config, base=main |

## Phase 1: Config Files

- [x] 1.1 Create `bunfig.toml` at project root with `[install] minimumReleaseAge = 864000`
- [x] 1.2 Add `SOCKET_SECURITY_API_KEY=` placeholder to `.env_example`

## Phase 2: CI Workflow

- [x] 2.1 Create `.github/workflows/socket.yml` for Socket.dev dependency scanning on PRs (non-blocking, continue-on-error)

## Phase 3: Verification

- [x] 3.1 Confirm `bunfig.toml` is valid TOML — validated via Python tomllib (parsed as `{'install': {'minimumReleaseAge': 864000}}`)
- [x] 3.2 Run `make validate` to confirm no breakage from file additions — 19 suites, 127 tests, all green
- [x] 3.3 Verify socket.yml syntax — validated via Python yaml.safe_load (parsed successfully)
