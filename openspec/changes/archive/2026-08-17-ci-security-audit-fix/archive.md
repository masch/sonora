# Archive Report: Fix CI Security Audit Vulnerabilities

**Change**: `ci-security-audit-fix`  
**Date**: 2026-08-17  
**Status**: Completed & Archived  
**Branch**: `fix/ci-security-audit-vulnerabilities`

---

## 1. Executive Summary

Resolved the scheduled GitHub Actions `security-audit` workflow failure by remediating 10 reported vulnerabilities across transitive dependencies. Pinned patched versions for active packages and established an explicitly documented build-time allowlist for unpatchable upstream toolchain dependencies.

---

## 2. Implemented Resolutions

### A. Monorepo Package Overrides (`package.json`)

Forced resolution of patched transitive versions across all monorepo workspaces:

- **`lodash`**: Pinned to `4.18.1` (mitigating Prototype Pollution & Code Injection).
- **`sharp`**: Pinned to `0.35.3` (mitigating libvips CVEs).
- **`undici`**: Pinned to `7.29.0` (mitigating CRLF injection & cookie/info disclosure).

### B. CI Allowlist & Threat Model (`.github/workflows/security-audit.yml`)

- Added explicit allowlist for `image-size` advisories `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`.
- **Threat Model Rationale**:
  - Upstream `image-size/image-size` is archived; no official patch `>=2.0.3` exists on npm.
  - `image-size` is strictly a build-time dependency for Metro/Expo bundling local trusted repository assets.
  - Never exposed to user-uploaded content or runtime API endpoints (blast radius = 0).
  - Avoids introducing unverified third-party forks into the core bundling pipeline.

---

## 3. Verification Evidence

- **Audit Check**: `bun audit` outputs 0 unhandled vulnerabilities at or above `moderate` severity.
- **Validation Gate**: `make validate` executed successfully:
  - ESLint & TypeCheck: 0 errors across all workspaces (`@sonora/mobile`, `@sonora/admin`, `@sonora/api`).
  - Unit & Integration Tests: 164 Vitest tests + 27 Jest tests passed (100% success rate).

---

## 4. Deliverables & Artifacts

- **Proposal**: `.agents/sdd/ci-security-audit-fix/proposal.md`
- **Specification**: `.agents/sdd/ci-security-audit-fix/spec.md`
- **Design**: `.agents/sdd/ci-security-audit-fix/design.md`
- **Tasks**: `.agents/sdd/ci-security-audit-fix/tasks.md`
- **Archive**: `.agents/sdd/ci-security-audit-fix/archive.md`
- **Engram**: Synced across memories and `.engram/chunks/`
