## Exploration: supply-chain-security

### Current State

1. **No `bunfig.toml` exists** — neither at project root (`/home/masch/dev/js/sonora/bunfig.toml`) nor at `$HOME/.bunfig.toml`. Bun runs with all defaults. Bun version is `1.3.3` (a version before the 3-day `minimumReleaseAge` default was introduced in later Bun builds, so the feature is available but opt-in only).

2. **No dependency security scanning** — no Socket.dev, Snyk, Dependabot, or any supply chain security tooling is configured anywhere in the project. Zero existing security checks in CI or pre-commit hooks.

3. **Existing CI pipeline** (`.github/workflows/pr.yml`):
   - Runs on `pull_request: [opened, synchronize, reopened]`
   - Steps: `checkout@v5` → `setup-bun@v2` → `bun install --frozen-lockfile` → `make format-check test lint typecheck` → `react-doctor`
   - No security scanning step exists

4. **Makefile**: Has `validate` (full development gate: format → test → lint → typecheck → gga) and `check` (CI gate: format-check → test → lint → typecheck). No security scanning targets exist. `make install` runs `bun install` + sets git hooks path.

5. **Pre-commit hook** (`.githooks/pre-commit`): Runs format, test, lint, typecheck, gga. No security scanning.

6. **Package manager**: Uses `bun.lock` (not `package-lock.json` or `yarn.lock`). Lockfile committed.

### Affected Areas

- `bunfig.toml` — **NEW FILE** — will be created at project root with `[install] minimumReleaseAge` config
- `.github/workflows/pr.yml` — will add a Socket.dev security scanning step
- `.env` / `.env_example` — may need `SOCKET_SECURITY_API_KEY` documented (secret, never committed)
- `.github/workflows/socket.yml` — **NEW FILE** — optional dedicated workflow for Socket.dev scanning
- `Makefile` — optionally add a `make socket-scan` target for local runs

### Approaches

#### Approach 1: Bun `minimumReleaseAge` (single option — no tradeoffs)

Create `bunfig.toml` at project root with:

```toml
[install]
# 10 days in seconds — filter out packages published less than 10 days ago
# to protect against supply chain attacks with freshly-published malicious versions
minimumReleaseAge = 864000
```

This is a declarative config change with no runtime cost. Bun 1.3.3 supports this field natively. The filter applies only to direct workspace dependencies (not transitive), per Bun's own fix in oven-sh/bun#27005.

- **Pros**: Zero maintenance, zero runtime cost, native Bun feature, immediately effective on next `bun install`
- **Cons**: May occasionally block legitimate new packages for 10 days; can be worked around with `minimumReleaseAgeExcludes` for trusted packages
- **Effort**: Low (single file, 4 lines)

#### Approach 2: Socket.dev — GitHub Action via `SocketDev/socket-basics`

Add a dedicated workflow (`.github/workflows/socket.yml`) using the official `SocketDev/socket-basics` action. This is Socket.dev's newer, simpler integration that requires a `SOCKET_SECURITY_API_KEY` secret configured in GitHub repo settings.

Key characteristics:

- Runs SAST, secret scanning, dependency analysis, and supply chain risk detection
- Configured via Socket Dashboard (zero config in CI YAML beyond API key)
- Posts PR comments with findings automatically
- Supports SBOM generation, reachability analysis

```yaml
# .github/workflows/socket.yml
name: Socket Security
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  issues: write
  pull-requests: write
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: SocketDev/socket-basics@v2.0.3
        env:
          GITHUB_PR_NUMBER: ${{ github.event.pull_request.number }}
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          socket_security_api_key: ${{ secrets.SOCKET_SECURITY_API_KEY }}
```

- **Pros**: Comprehensive scanning (supply chain, SAST, secrets), no local deps, PR feedback integrated, managed dashboard, free tier available
- **Cons**: Requires Socket.dev account + API key, depends on external SaaS, API key management in GitHub Secrets
- **Effort**: Medium (create workflow, set up account, configure secrets)

#### Approach 3 (Alternative): Socket.dev — CLI-based `socket npm` wrapper

Install the `socket` npm package globally or as a dev dependency and wrap `bun install` calls. This runs Socket scanning during local installs rather than (or in addition to) CI.

- **Pros**: Catches issues at install time locally
- **Cons**: Doesn't integrate with `bun` directly (`socket npm` wraps `npm`, not `bun`); adds friction to every install; less suitable for CI gating without additional scripting
- **Effort**: Medium-High
- **Verdict**: REJECTED — poor Bun compatibility, local friction outweighs benefits

### Recommendation

**Do both changes as a single SDD change:**

1. **`bunfig.toml` with `minimumReleaseAge = 864000`** — no-brainer, low effort, high value. No tradeoffs.

2. **Socket.dev via `SocketDev/socket-basics` GitHub Action** — dedicated workflow for security scanning on PRs. This is the most practical approach: it's zero-config beyond the API key, catches supply chain issues at PR time, and integrates feedback directly into PRs.

   The API key setup is a one-time manual step:
   1. Create a Socket.dev account (free tier)
   2. Generate an API key from Socket dashboard
   3. Add `SOCKET_SECURITY_API_KEY` to GitHub repo secrets
   4. Add `SOCKET_SECURITY_API_KEY` to `.env_example` as a placeholder (with empty value and a comment that it's for CI)

   Consider also adding `SOCKET_SECURITY_API_KEY` to `.env_example` as a documentation placeholder (empty string with comment) so developers know it's expected.

### Risks

- **`minimumReleaseAge` blocks legitimate packages**: A 10-day window could block urgent security patches for direct dependencies. Mitigation: use `minimumReleaseAgeExcludes` selectively, or document the workaround (`bun add --minimum-release-age 0`).
- **Socket.dev API key management**: If the key is not set, the workflow will fail. Must be documented clearly in onboarding. Mitigation: make the Socket workflow conditional with `if: env.SOCKET_SECURITY_API_KEY != ''` for graceful degradation.
- **Socket.dev false positives**: Like all security scanners, may flag benign behavior. Team needs to triage and configure policy in Socket Dashboard.
- **Socket.dev is external SaaS**: If Socket.dev is down, the CI step fails (or is skipped if made conditional). Mitigation: non-blocking status — allow CI to pass even if Socket scan fails, but report findings.

### Ready for Proposal

Yes. The scope is well-defined: two additive changes (bunfig config + CI workflow). Both are independent but logically grouped under "supply chain security." No complex refactoring or behavioral changes to application code.
