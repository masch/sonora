# Spec: Fix CI Security Audit Vulnerabilities

## 1. Context & Objectives

The CI job `Security Audit` runs `bun audit --json` and fails if any vulnerability meets or exceeds the severity threshold (`moderate` by default).

### Identified Vulnerabilities

1. **`lodash`** (>=4.0.0 <=4.17.23): High (Code Injection) & Moderate (Prototype Pollution)
   - Resolution: Pin `lodash` to `4.18.1` in root `package.json` overrides & resolutions.
2. **`sharp`** (<0.35.0): High (libvips CVEs)
   - Resolution: Pin `sharp` to `0.35.3` in root `package.json` overrides & resolutions.
3. **`undici`** (>=7.0.0 <7.29.0): High (info disclosure/crash) & Moderate (CRLF injection/cookies)
   - Resolution: Pin `undici` to `7.29.0` (compatible with v7 tree) in root `package.json` overrides & resolutions.
4. **`image-size`** (<=2.0.2): High (ICNS & JXL/HEIF infinite loop DoS)
   - **Upstream status**: The original `image-size/image-size` repository is archived; no official patch >=2.0.3 exists on npm.
   - **Threat Model Analysis**: The vulnerability triggers an infinite loop DoS only if a maliciously crafted ICNS/HEIF image is parsed. In Sonora, `image-size` is strictly a build-time transitive dependency (Expo CLI/Metro) that only runs on trusted repository static assets. It is never exposed to user-uploaded files or runtime API requests (blast radius = 0).
   - **Resolution**: Document explicit allowlist in `.github/workflows/security-audit.yml` to prevent CI failure without taking supply-chain risks with unverified forks.

## 2. Requirements & Acceptance Criteria

### Requirement 1: Dependency Overrides

- `package.json` `overrides` and `resolutions` must include patched versions:
  - `"lodash": "4.18.1"`
  - `"sharp": "0.35.3"`
  - `"undici": "7.29.0"`
- All pinned versions must comply with `bunfig.toml` (`minimumReleaseAge = 345600`).

### Requirement 2: Security Audit Workflow Enhancement

- `.github/workflows/security-audit.yml` should support an explicit ignored advisories / allowlist configuration (e.g. `audit-exceptions.json` or inline ignore filter in the parser step) for known upstream vulnerabilities with no upstream fix available.
- Specifically allow `image-size` (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) with reason: "No upstream fix published for Expo/React-Native build dependency".

### Requirement 3: Quality & Verification Gates

- `bun install` succeeds with exact lockfile update.
- `make validate` passes across all monorepo workspaces without regressions.
- CI security audit check produces 0 unhandled vulnerabilities above threshold.
