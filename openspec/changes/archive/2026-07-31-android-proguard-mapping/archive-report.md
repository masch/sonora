# SDD Archive Report: android-proguard-mapping

**Change:** `android-proguard-mapping`
**Phase:** Archive
**Date:** 2026-07-31 (UTC; local date 2026-07-30 — matches all recorded change timestamps)
**Branch:** `feat/android-proguard-mapping`
**HEAD:** `1aa399f` (fail-fast mapping policy, on top of `66e5b99` initial implementation)
**PR:** <https://github.com/masch/sonora/pull/361> (OPEN)

## Archive Status

**PASS — archived as a non-critical partial archive (parent-approved).**

- FR-1..FR-4 (the code implementation) verified PASS by inspection, YAML parse, and `make -n` dry run (verify-report).
- Mapping policy is **MANDATORY / fail-fast** (maintainer decision 2026-07-31): missing mapping blocks the release at every stage. NFR-2 (graceful degradation) was replaced by this policy; specs updated to fail-fast scenarios.
- FR-5 / AC-5 (manual R8 verification) and AC-2/3/4 (CI-runtime and deployment evidence) are **pending post-archive follow-ups**, explicitly approved by the parent not to block archive.
- No stale-checkbox repair performed: the open checkboxes stay open and are recorded as follow-ups below.

## Artifacts Read

| Artifact            | File                                                                                           | Engram topic / obs                                             |
| ------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Proposal            | `openspec/changes/android-proguard-mapping/proposal.md`                                        | `sdd/android-proguard-mapping/proposal` (obs 148)              |
| Spec (domain)       | `openspec/changes/android-proguard-mapping/specs/{build-tooling,mobile-deployment}/spec.md`    | `sdd/android-proguard-mapping/spec` (obs 149)                  |
| Spec (flat, legacy) | `openspec/changes/android-proguard-mapping/spec.md`                                            | —                                                              |
| Design              | `openspec/changes/android-proguard-mapping/design.md`                                          | `sdd/android-proguard-mapping/design` (obs 150)                |
| Tasks               | `openspec/changes/android-proguard-mapping/tasks.md`                                           | `sdd/android-proguard-mapping/tasks` (obs 151)                 |
| Apply progress      | Engram-only (`apply-progress.md` never file-backed)                                            | `sdd/android-proguard-mapping/apply-progress` (obs 914, rev 4) |
| Verify report       | `openspec/changes/android-proguard-mapping/verify-report.md`                                   | `sdd/android-proguard-mapping/verify-report` (obs 916)         |
| Sync report         | **absent** — file-backed sync never ran; archive-time sync fallback executed (parent-approved) | —                                                              |
| Config              | `openspec/config.yaml` (`artifact_store: hybrid`, `strict_tdd: true`)                          | —                                                              |

## Structured Status and Action Context Findings

- **Artifact store:** `both`/hybrid — `openspec/` dir exists → disk-authoritative; Engram used for apply-progress and archive report.
- **Native dispatcher** (`gentle-ai sdd-status --json`): `artifactStore: openspec`, `blockedReasons: []`, `actionContext.mode: repo-local`, `workspaceRoot: /var/home/masch/dev/js/sonora`, `allowedEditRoots: [/var/home/masch/dev/js/sonora]` — all archive paths inside the allowed root.
- Native engine reported `nextRecommended: apply` and `dependencies.verify/archive: blocked` — this reflects engine blindness to the Engram-only apply-progress and to the parent's explicit approvals. Per the Archive Final-State Handoff, the parent's explicit final-state facts and approvals outrank stale snapshot/engine claims.
- **Verify-report snapshot reconciliation** (recorded final state at close, per parent handoff):
  - "TDD Evidence reported ❌ CRITICAL" → **resolved**: apply-progress (obs 914, rev 4, updated 2026-07-31 01:43 UTC, after the verify snapshot) now contains the `TDD Cycle Evidence` table, all N/A — structural infra (Makefile + GitHub Actions YAML), no testable JS/TS code.
  - "Archive status: NOT READY" paragraph and NFR-2 Gap warnings in Spec Coverage → **superseded**: parent explicitly approved the partial archive with follow-ups; NFR-2 gap marked RESOLVED in verify Blockers (fail-fast policy replaces graceful degradation).
  - Verify Test-Commands table's `HEAD = 66e5b99` line is stale; actual HEAD at close is `1aa399f` (fail-fast), tree clean.

## Domains Synced (archive-time sync fallback, parent-approved)

| Domain            | Canonical path                             | Mode                                                        | Requirements |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------- | ------------ |
| build-tooling     | `openspec/specs/build-tooling/spec.md`     | **ADDED** (new canonical spec, pure copy — non-destructive) | 3            |
| mobile-deployment | `openspec/specs/mobile-deployment/spec.md` | **ADDED** (new canonical spec, pure copy — non-destructive) | 7            |

Sync result: both canonical files created, byte-identical to the change specs (`diff` clean). No MODIFIED/REMOVED operations were needed, so the destructive merge guard did not apply.

### Requirement names (ADDED to canonical)

**build-tooling:**

- Mapping File Capture
- Consistent Naming Convention
- Capture Position

**mobile-deployment:**

- Mapping Artifact Upload (build-android job)
- Pipeline Dependency (deploy-play-store job)
- Mapping Artifact Download (deploy-play-store job)
- Play Console Mapping Upload
- Mapping-AAB Release Consistency
- Mandatory Mapping (fail-fast)
- One-Time R8 Configuration Verification

## Active Same-Domain Change Warnings

**None.** `android-proguard-mapping` is the only active change under `openspec/changes/`; no other active change touches `build-tooling` or `mobile-deployment` specs. (Note for context: `openspec/specs/google-play-publishing` exists as an adjacent canonical domain; no overlap or conflict.)

## Legacy Flat Spec Note

A flat `openspec/changes/android-proguard-mapping/spec.md` (combined FR/NFR/AC spec, still reflecting the older NFR-2 graceful-degradation wording) exists **alongside** the authoritative domain specs under `specs/` (which contain the fail-fast scenarios). It is not the only spec artifact, so it is not an archive blocker; it is legacy/duplicative and was superseded by the per-domain specs. It moves to the archive with the change folder as-is (audit trail preserved, not modified).

## Open Post-Archive Follow-ups (NOT completed, parent-approved, do not block archive)

Unchecked implementation-owned tasks (manual/runtime verification, cannot run in this environment):

1. `[ ]` Run `npx expo prebuild --platform android --clean` in `apps/mobile/` to generate the native android project. (Phase 1, FR-5/AC-5)
2. `[ ]` Inspect `apps/mobile/android/app/build.gradle` and confirm `buildTypes.release.minifyEnabled` is `true` and `proguardFiles` references default R8 rules. (Phase 1)
3. `[ ]` Run `cd apps/mobile/android && ./gradlew :app:assembleRelease` and verify that `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` is generated. (Phase 1)
4. `[ ]` Verify the Makefile change by running the target locally with explicit `OUTPUT_APK`, `OUTPUT_AAB`, and `OUTPUT_MAPPING` and confirming the mapping file is created at the expected path. (Phase 2 — annotated `post-archive follow-up (parent-approved)`)
5. `[ ]` Trigger a CI run via `workflow_dispatch` on the production Android workflow and confirm: `build-android` succeeds and produces `android-mapping` artifact (30-day retention); `deploy-play-store` downloads it and includes `mappingFile`; no CI step fails if the mapping file is absent. (Phase 5 — annotated `post-archive follow-up (parent-approved)`)

Unchecked parent-owned tasks (deferred):

1. `[ ]` Document any R8 configuration findings; if `minifyEnabled` is not `true`, note a separate change is needed before the pipeline produces mapping files. (Phase 1, `sdd-owner: parent`)
2. `[ ]` Start or reuse bounded review across the two modified files (`Makefile`, `deploy-mobile-android-production.yml`) to confirm each change matches spec and design exactly. (Post-Apply Review, `sdd-owner: parent`)

**Confirmation:** all 6 implementation-owned **code-change** tasks are `[x]` (Makefile `cp` + `OUTPUT_MAPPING`; workflow `OUTPUT_MAPPING`; upload-artifact step; `needs` array; download-artifact step; `mappingFile` input). No other `- [ ]` implementation task boxes remain besides the 5 follow-ups above.

## Partial Archive Approval Record

Parent prompt explicitly approved (2026-07-31): "Post-archive follow-ups APPROVED (do NOT block archive)" — the manual/runtime tasks above (Phases 1, 2-verify, 5) and the post-apply bounded review are recorded as follow-ups, not completed, and remain unchecked in `tasks.md` with `post-archive follow-up` annotations. No checkbox repair was performed. This is the recorded non-critical partial archive exception per the archive contract; CRITICAL verification issues were resolved (TDD evidence reconciled; NFR-2 fail-fast decision) before close.

## Destructive Merge Approvals / Blockers

- Destructive merge guard: **not applicable** — no MODIFIED/REMOVED canonical spec operations; both canonical specs created fresh (pure copy, parent-approved archive-time sync fallback).
- No verification blockers at close: no unresolved `FAIL`, `BLOCKED`, or `CRITICAL` findings remain. (`reviewGate` in native status is `null` — the post-apply bounded review is the parent-owned follow-up #7 above; the parent approved archiving with it deferred.)

## Archived Path

`openspec/changes/android-proguard-mapping/` → `openspec/changes/archive/2026-07-31-android-proguard-mapping/`

All artifacts (proposal, flat legacy spec, per-domain specs, design, tasks, verify-report, this archive report) move intact; nothing deleted or modified.

## Memory Observation IDs

- Proposal: obs 148
- Spec: obs 149
- Design: obs 150
- Tasks: obs 151
- Apply progress: obs 914 (rev 4 — includes TDD Cycle Evidence table)
- Verify report: obs 916
- Archive report: saved to `sdd/android-proguard-mapping/archive-report` (see this topic for the observation ID)
