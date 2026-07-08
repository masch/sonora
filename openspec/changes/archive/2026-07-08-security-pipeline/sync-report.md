# Sync Report — security-pipeline

**Date**: 2026-07-08
**Mode**: archive-time sync fallback

## Domains Synced

### 1. `version-pinning` — New canonical spec

- **Action**: Full copy from change spec
- **Path**: `openspec/specs/version-pinning/spec.md`
- **Requirements**: PIN.1 (Exact Version Constraints), PIN.2 (Version Source), PIN.3 (Install Integrity After Pinning), PIN.4 (Scope of Changes)
- **Active same-domain changes**: None

### 2. `dependency-updates` — New canonical spec

- **Action**: Full copy from change spec
- **Path**: `openspec/specs/dependency-updates/spec.md`
- **Requirements**: DEP.1 (Renovate Configuration File), DEP.2 (Bun Manager), DEP.3 (Weekly Update Schedule), DEP.4 (Dependency Dashboard), DEP.5 (Deterministic Version Pinning), DEP.6 (Renovate Operational)
- **Active same-domain changes**: None

### 3. `ci` — Existing canonical spec (merge)

- **Action**: Append ADDED requirements CI.5 and CI.6
- **Path**: `openspec/specs/ci/spec.md`
- **ADDED Requirements**:
  - CI.5 — Security Audit Workflow (weekly `bun audit` with severity threshold, step summary, manual dispatch)
  - CI.6 — Security Notification (Optional GitHub Issue creation on findings)
- **MODIFIED Requirements**: None
- **REMOVED Requirements**: None
- **Active same-domain changes**: ⚠️ `openspec/changes/gh-ci-refactor/specs/ci/spec.md` also targets the CI domain with its own CI.5 (Composite Bun Setup Action), CI.6 (Workflow Naming Convention), and CI.7 (Configurable Mobile Staging Deploy). Numbering collision exists between the two changes' CI.5 and CI.6 requirements. These are semantically different requirements and will coexist in the canonical spec once both are merged.

## Merge Details

- CI.5 and CI.6 were converted from the delta format (`### Requirement: CI.N — Title`) to the canonical format (`## CI.N: Title`) with matching scenario formatting.
- No destructive changes were applied (REMOVED/MODIFIED guard not triggered — only ADDED requirements present).
- Verification: All 26 package.json changes pinned, `bun install --frozen-lockfile` passes, lockfile unchanged.

## Destructive Merge Guard

Not applicable — no MODIFIED or REMOVED requirements in this change.

## Risks

- ⚠️ `gh-ci-refactor` active change also defines CI.5 and CI.6 with different semantics. When that change is synced, the canonical spec will contain both sets. Manual reconciliation may be needed if numbering overlap causes confusion.
