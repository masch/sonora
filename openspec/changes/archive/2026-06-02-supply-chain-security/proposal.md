# Proposal: Supply Chain Security

## Intent

Sonora has zero supply chain security protections. No guard against recently-published malicious dependency versions, and no automated dependency risk scanning in CI. Two low-effort, high-value protections close this gap without changing any application code.

## Scope

### In Scope

- Create `bunfig.toml` with `[install] minimumReleaseAge = 864000` (10 days)
- Add Socket.dev GitHub Action workflow for dependency risk scanning on PRs
- Document `SOCKET_SECURITY_API_KEY` in `.env_example` as placeholder

### Out of Scope

- Pre-commit hook changes (CI-only scanning is sufficient)
- Makefile targets for local scanning (Socket CLI was rejected in exploration)
- Other security tooling (Snyk, Dependabot, etc.)

## Capabilities

### New Capabilities

None — pure configuration/maintenance change. No new capabilities introduced.

### Modified Capabilities

None — no spec-level behavior changes. Application code is untouched.

## Approach

### 1. Bun `minimumReleaseAge`

Create `bunfig.toml` at project root:

```toml
[install]
minimumReleaseAge = 864000
```

Native Bun feature, zero runtime cost, active on next `bun install`. 10-day window blocks supply chain attacks that publish malicious versions. Workaround: `bun add --minimum-release-age 0` for urgent packages.

### 2. Socket.dev CI scanning

New `.github/workflows/socket.yml` using `SocketDev/socket-basics@v2.0.3`. Runs on PR open/sync/reopen. Requires `SOCKET_SECURITY_API_KEY` in GitHub secrets. Non-blocking — step conditionally runs only when the key is present, so missing config doesn't block CI. Scans dependencies, secrets, and SAST; posts findings as PR comments.

Add `SOCKET_SECURITY_API_KEY=` to `.env_example` as empty placeholder to document the expected secret name.

## Affected Areas

| Area                           | Impact   | Description                              |
| ------------------------------ | -------- | ---------------------------------------- |
| `bunfig.toml`                  | New      | Bun install config — minimum release age |
| `.github/workflows/socket.yml` | New      | Socket.dev dependency security scan      |
| `.env_example`                 | Modified | Document Socket.dev API key placeholder  |

## Risks

| Risk                                | Likelihood | Mitigation                                                            |
| ----------------------------------- | ---------- | --------------------------------------------------------------------- |
| 10-day window blocks urgent patches | Low        | Override via `--minimum-release-age 0` or `minimumReleaseAgeExcludes` |
| Socket.dev API key not set          | Medium     | Workflow is conditional on key presence; document in `.env_example`   |
| Socket.dev false positives          | Medium     | Configure ignore rules in Socket Dashboard                            |
| Socket.dev SaaS downtime            | Low        | Non-blocking step — CI passes even if scan fails                      |

## Rollback Plan

- **`bunfig.toml`**: Delete the file or comment out the `minimumReleaseAge` line. Next `bun install` reverts to default.
- **`.github/workflows/socket.yml`**: Delete the file. No CI impact.
- **`.env_example`**: Remove the `SOCKET_SECURITY_API_KEY` line.

## Success Criteria

- [ ] `bun install` respects `minimumReleaseAge` — packages under 10 days old are blocked
- [ ] Socket.dev workflow runs on every PR open/sync/reopen
- [ ] Socket.dev PR comments appear with dependency risk findings
- [ ] CI passes gracefully when `SOCKET_SECURITY_API_KEY` is absent
