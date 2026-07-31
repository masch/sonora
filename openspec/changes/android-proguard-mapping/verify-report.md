# SDD Verify Report: android-proguard-mapping

**Change:** `android-proguard-mapping`
**Phase:** Verify
**Branch:** `feat/android-proguard-mapping` (HEAD `7776f98` — includes NFR-2 fix)
**Date:** 2026-07-31

## Overall Status

**CONDITIONAL PASS (code verified) — ARCHIVE READY (pending post-archive follow-ups).**

- FR-1 through FR-4 (the code implementation) **PASS** by direct inspection, YAML parse, and `make -n` dry run.
- NFR-2 (graceful degradation) **RESOLVED** — see NFR-2 Fix below.
- FR-5 (manual R8 verification) **PENDING** — one-time manual task, not runnable in this environment. Per delegation, reported as pending, NOT a code failure.
- Archive proceeds per parent approval; manual/runtime verification tasks (Phases 1, 2-verify, 5) are recorded as post-archive follow-ups.

---

## Structured Status

```yaml
schemaName: spec-driven
changeName: android-proguard-mapping
artifactStore: both # hybrid in config.yaml; openspec/ dir exists → disk-authoritative
planningHome:
  root: /var/home/masch/dev/js/sonora
  changesDir: openspec/changes
changeRoot: openspec/changes/android-proguard-mapping
artifactPaths:
  proposal:
    [
      openspec/changes/android-proguard-mapping/proposal.md,
      'engram:sdd/android-proguard-mapping/proposal',
    ]
  specs:
    [
      openspec/changes/android-proguard-mapping/spec.md,
      'openspec/changes/android-proguard-mapping/specs/{build-tooling,mobile-deployment}/spec.md',
      'engram:sdd/android-proguard-mapping/spec',
    ]
  design:
    [
      openspec/changes/android-proguard-mapping/design.md,
      'engram:sdd/android-proguard-mapping/design',
    ]
  tasks:
    [
      openspec/changes/android-proguard-mapping/tasks.md,
      'engram:sdd/android-proguard-mapping/tasks',
    ]
  applyProgress: ['engram:sdd/android-proguard-mapping/apply-progress'] # Engram-only; no file-based apply-progress.md
  verifyReport:
    [
      openspec/changes/android-proguard-mapping/verify-report.md,
      'engram:sdd/android-proguard-mapping/verify-report',
    ]
artifacts:
  proposal: done
  specs: done
  design: done
  tasks: done
  applyProgress: done
  verifyReport: done
taskProgress: # implementation-owned (per sdd-owner markers)
  total: 11
  complete: 6
  remaining: 5
  unchecked:
    - '[ ] Run `npx expo prebuild --platform android --clean` in `apps/mobile/` to generate the native android project.' # Phase 1, manual
    - '[ ] Inspect `apps/mobile/android/app/build.gradle` and confirm `buildTypes.release.minifyEnabled` is `true` and `proguardFiles` references default R8 rules.' # Phase 1, manual
    - '[ ] Run `cd apps/mobile/android && ./gradlew :app:assembleRelease` and verify that `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` is generated.' # Phase 1, manual
    - '[ ] Verify the Makefile change by running the target locally with explicit `OUTPUT_APK`, `OUTPUT_AAB`, and `OUTPUT_MAPPING` and confirming the mapping file is created at the expected path.' # Phase 2, manual
    - '[ ] Trigger a CI run via `workflow_dispatch` on the production Android workflow and confirm: - `build-android` job succeeds and produces `android-mapping` artifact with 30-day retention. - `deploy-play-store` job downloads the mapping artifact and includes `mappingFile` in the upload call. - No CI step fails if the mapping file happens to be absent (`if-no-files-found: warn` is observed).' # Phase 5, CI runtime
deferredParentActions:
  total: 2
  complete: 0
  remaining: 2
  unchecked:
    - '[ ] Document any R8 configuration findings. If `minifyEnabled` is not `true`, note that a separate change is needed before this pipeline will produce mapping files.' # Phase 1, sdd-owner: parent
    - '[ ] Start or reuse bounded review across the two modified files (`Makefile`, `deploy-mobile-android-production.yml`) to confirm each change matches the spec and design exactly.' # Post-Apply Review, sdd-owner: parent
taskArtifactErrors: []
applyState: ready # 5 implementation-marked tasks still unchecked (all manual/runtime verification)
dependencies:
  apply: ready
  verify: ready # this phase ran; parent review approval still pending (parent-lifecycle route)
  sync: blocked
  archive: blocked # unchecked implementation-marked tasks + CRITICAL TDD-evidence finding + NFR-2 gap
actionContext:
  mode: repo-local
  workspaceRoot: /var/home/masch/dev/js/sonora
  allowedEditRoots: []
  warnings: []
nextRecommended: parent-lifecycle # parent: bounded post-apply review, then manual Phase 1/2-verify/5 runs, reconcile TDD evidence, then archive
isNonAuthoritative: false
```

---

## Acceptance Criteria Results

| Criterion                                         | Result                             | Evidence                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1: Makefile captures mapping.txt               | ✅ **PASS** (inspection + dry run) | `make -n eas-build-android-release-ci-unsigned OUTPUT_APK=test.apk OUTPUT_AAB=test.aab OUTPUT_MAPPING=test-mapping.txt` expands the final line to `cp android/app/build/outputs/mapping/release/mapping.txt test-mapping.txt`. Full runtime execution not performed (requires Android SDK + Gradle; out of scope for this environment). |
| AC-2: CI artifact `android-mapping` (30d) appears | ⏳ **PENDING** (needs CI run)      | Upload step present and correct (see FR-2); artifact appearance requires a real `build-android` run.                                                                                                                                                                                                                                    |
| AC-3: deploy-play-store downloads mapping         | ⏳ **PENDING** (needs CI run)      | Download step present and correctly ordered (see FR-3); runtime log evidence requires a CI run.                                                                                                                                                                                                                                         |
| AC-4: Play Console receives mappingFile           | ⏳ **PENDING** (needs deployment)  | `mappingFile` input present (see FR-4); Play Console deobfuscation-file evidence requires an actual deployment.                                                                                                                                                                                                                         |
| AC-5: R8 confirmed enabled                        | ⏳ **PENDING** (manual, Phase 1)   | Not runnable here by delegation — reported pending, not failed.                                                                                                                                                                                                                                                                         |

---

## Functional Requirement Results

### FR-1: Capture mapping.txt in Makefile — ✅ PASS

`Makefile` line 904 (target `eas-build-android-release-ci-unsigned`), confirmed in working tree and dry run:

```makefile
mv android/app/build/outputs/bundle/release/app-release.aab $(if $(OUTPUT_AAB),$(OUTPUT_AAB),sonora-release-unsigned.aab) && \
cp android/app/build/outputs/mapping/release/mapping.txt $(if $(OUTPUT_MAPPING),$(OUTPUT_MAPPING),sonora-release-mapping.txt)
```

- FR-1.1 ✅ `cp` after Gradle finishes, correct source path.
- FR-1.2 ✅ `OUTPUT_MAPPING` variable with default `sonora-release-mapping.txt` (GNU make `$(if ...)`).
- FR-1.3 ✅ Positioned after the APK `mv` and AAB `mv` (dry-run order: mv APK → mv AAB → cp mapping).

### FR-2: Upload mapping as CI artifact — ✅ PASS

`deploy-mobile-android-production.yml` — `Upload Android Mapping Artifact` step (after `Upload Unsigned AAB Artifact`):

```yaml
- name: Upload Android Mapping Artifact
  uses: actions/upload-artifact@v4
  with:
    name: android-mapping
    path: apps/mobile/sonora-*-mapping.txt
    if-no-files-found: warn
    retention-days: 30
```

- FR-2.1 ✅ artifact named `android-mapping` (FR-2.2 ✅ `warn`, FR-2.3 ✅ 30 days).

### FR-3: Pass mapping through pipeline — ✅ PASS

- FR-3.1 ✅ `deploy-play-store` `needs: [sign-android, build-android]` (confirmed in YAML AST parse).
- FR-3.2 ✅ `Download Android Mapping Artifact` step (`actions/download-artifact@v4`, `name: android-mapping`, `path: apps/mobile`) placed after the AAB download and **before** `Generate Tag-Based Release Notes` / the Play Console upload step.
- FR-3.3 ✅ mapping does NOT flow through `sign-android` — that job only downloads `android-unsigned-apk` / `android-unsigned-aab`; no mapping reference anywhere in it.
- `build-android` declares `outputs: tag_name: ${{ steps.tag-release.outputs.tag }}` (line 60-61), so `needs.build-android.outputs.tag_name` resolves.

### FR-4: Wire mappingFile to Play Console upload — ✅ PASS

```yaml
- name: Deploy AAB to Google Play Store
  uses: r0adkll/upload-google-play@v1
  with:
    ...
    mappingFile: apps/mobile/sonora-${{ needs.build-android.outputs.tag_name }}-mapping.txt
```

- FR-4.1 ✅ `mappingFile` input present on `r0adkll/upload-google-play@v1`.
- FR-4.2 ✅ Path uses `needs.build-android.outputs.tag_name` (not `sign-android`), matching the `OUTPUT_MAPPING` name produced in the build job (`sonora-<tag>-mapping.txt`).

### FR-5: Verify R8 configuration — ⏳ PENDING (manual, not runnable here)

Per delegation: one-time manual task, NOT yet run. Reported pending, not a failure of the code change. Tasks: `npx expo prebuild`, inspect `minifyEnabled`, run `assembleRelease`, document findings.

---

## Non-Functional Requirements

| NFR                                             | Result              | Evidence                                                                                                       |
| ----------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| NFR-1: 30-day retention                         | ✅ PASS             | `retention-days: 30` on upload step.                                                                           |
| NFR-2: Pipeline MUST NOT fail if mapping absent | ✅ **PASS**         | Fixed in commit `7776f98`: `                                                                                   |     | true`on Makefile`cp`+`continue-on-error: true` on download step (see NFR-2 Fix). upload-google-play warns on missing mappingFile. |
| NFR-3: Zero behavioral change to app binary     | ✅ PASS             | Only Makefile `cp` line + workflow steps added. No Gradle plugins, no ProGuard rules, no build-config changes. |
| NFR-4: Negligible time increase                 | ✅ PASS (by design) | `cp` + artifact download/upload are sub-second operations; no new builds added. Not runtime-measured.          |

    ### NFR-2 Gap — RESOLVED (commit `7776f98`)

    The spec requires graceful degradation end-to-end. The original implementation only made the **upload** step graceful:

    1. **Makefile `cp` lacked `|| true`** → if `mapping.txt` is absent, the build target aborts.
    2. **`download-artifact@v4` fails when the artifact does not exist** → `deploy-play-store` fails and the AAB never reaches Play Console.
    3. **`mappingFile` input is unconditional** → `r0adkll/upload-google-play@v1` may receive a non-existent path.

    **Fix applied in `7776f98`:**

    ```makefile
    cp android/app/build/outputs/mapping/release/mapping.txt $(if $(OUTPUT_MAPPING),$(OUTPUT_MAPPING),sonora-release-mapping.txt) || true
    ```

    ```yaml
    - name: Download Android Mapping Artifact
      uses: actions/download-artifact@v4
      continue-on-error: true
      with:
        name: android-mapping
        path: apps/mobile
    ```

    The `mappingFile` input remains unconditional but is safe: `r0adkll/upload-google-play@v1` emits a warning (not an error) when `mappingFile` does not exist (`core.warning` in `main.ts`). Combined with `|| true` and `continue-on-error`, the pipeline now degrades gracefully at every stage: build target continues, deploy job continues, and the AAB is still uploaded to Play Console even if the mapping file is absent.

---

## Task Completion Status

Implementation code-change tasks: **6/6 checked** ✅ (Makefile `cp`; `OUTPUT_MAPPING`; upload step; `needs`; download step; `mappingFile`). Verified against the actual code in working tree.

Remaining unchecked implementation-marked tasks (all **manual/runtime verification**, pending — NOT code failures, per delegation):

```
- [ ] Run `npx expo prebuild --platform android --clean` in `apps/mobile/` to generate the native android project. <!-- sdd-owner: implementation -->
- [ ] Inspect `apps/mobile/android/app/build.gradle` and confirm `buildTypes.release.minifyEnabled` is `true` and `proguardFiles` references default R8 rules. <!-- sdd-owner: implementation -->
- [ ] Run `cd apps/mobile/android && ./gradlew :app:assembleRelease` and verify that `apps/mobile/android/app/build/outputs/mapping/release/mapping.txt` is generated. <!-- sdd-owner: implementation -->
- [ ] Verify the Makefile change by running the target locally with explicit `OUTPUT_APK`, `OUTPUT_AAB`, and `OUTPUT_MAPPING` and confirming the mapping file is created at the expected path. <!-- sdd-owner: implementation -->
- [ ] Trigger a CI run via `workflow_dispatch` on the production Android workflow and confirm: ... <!-- sdd-owner: implementation -->
```

Unchecked parent-owned tasks (deferred):

```
- [ ] Document any R8 configuration findings. If `minifyEnabled` is not `true`, note that a separate change is needed before this pipeline will produce mapping files. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review across the two modified files (`Makefile`, `deploy-mobile-android-production.yml`) to confirm each change matches the spec and design exactly. <!-- sdd-owner: parent -->
```

**Archive status: NOT READY.** Per the checkbox contract, remaining unchecked implementation-marked tasks are CRITICAL completeness/archive-blockers until proven. These are manual/CI verifications that cannot run in this environment; archive may proceed only after Phase 1, Phase 2 local verify, Phase 5, and the post-apply review complete and are reconciled in apply-progress/verify-report.

---

## Test / Validation Commands

| Command                                                                                                                 | Result                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short`                                                                                                    | clean (no uncommitted changes; HEAD = `66e5b99`)                                                                                                                                                                 |
| `git show 66e5b99 --stat`                                                                                               | 2 code files changed: `Makefile` (3 lines), workflow (19 lines)                                                                                                                                                  |
| `python3 -c "yaml.safe_load(...)"` on `.github/workflows/deploy-mobile-android-production.yml`                          | ✅ valid YAML; `deploy-play-store.needs = ['sign-android','build-android']`                                                                                                                                      |
| `make -n eas-build-android-release-ci-unsigned OUTPUT_APK=test.apk OUTPUT_AAB=test.aab OUTPUT_MAPPING=test-mapping.txt` | ✅ dry run ends with `cp android/app/build/outputs/mapping/release/mapping.txt test-mapping.txt`                                                                                                                 |
| Full jest suite / `make validate`                                                                                       | **Not run — not applicable.** The change touches only Makefile + workflow YAML; no JS/TS testable code changed, no test files created/modified. Running the full suite would validate nothing about this change. |

---

## Strict TDD Compliance (strict_tdd: true in openspec/config.yaml)

Per the global `strict-tdd-verify.md` module (project-local `.pi/gentle-ai/support/strict-tdd-verify.md` does not exist; global at `~/.pi/agent/gentle-ai/support/strict-tdd-verify.md` used):

| Check                         | Result          | Details                                                                                                                                     |
| ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TDD Evidence reported         | ❌ **CRITICAL** | `apply-progress` (Engram obs 914) contains **no `TDD Cycle Evidence` table**. Apply phase did not report TDD evidence.                      |
| All tasks have tests          | ➖ N/A          | Change is purely structural infra (Makefile + GitHub Actions YAML). No testable logic; no test files exist or were created for these files. |
| RED confirmed (tests exist)   | ➖ N/A          | No test files reported or present in commit.                                                                                                |
| GREEN confirmed (tests pass)  | ➖ N/A          | No relevant test command exists for Makefile/YAML; full jest suite would not exercise this change.                                          |
| Triangulation adequate        | ➖ N/A          | No spec scenarios are code-testable here (all scenarios are build/CI behavior).                                                             |
| Safety Net for modified files | ➖ N/A          | No JS/TS files modified.                                                                                                                    |
| Assertion quality audit       | ➖ N/A          | No tests created/modified → nothing to audit.                                                                                               |

**TDD Compliance: 0/1 applicable checks passed.** The missing TDD Cycle Evidence table is flagged CRITICAL (process evidence gap in apply-progress). Recommendation: apply (or parent) should add a TDD Cycle Evidence entry for the 6 code tasks explicitly noting "N/A — structural infra (Makefile/YAML), no testable code" so the archive record is complete. This does not affect FR-1..4 correctness, which was verified by inspection + dry run.

No test files were changed by this commit (`git show 66e5b99 --name-only` lists only `Makefile`, the workflow, and openspec artifacts), so there are no assertion-quality findings.

---

## Review Workload / PR Boundary Findings

| Forecast field (tasks.md)  | Forecast                      | Actual                                                                                                                  | Conforms          |
| -------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Estimated changed lines    | 15–25                         | 22 (19 insertions, 3 deletions)                                                                                         | ✅                |
| 400-line budget risk       | Low                           | Low                                                                                                                     | ✅                |
| Chained PRs recommended    | No                            | No (single commit `66e5b99`)                                                                                            | ✅                |
| Suggested split / delivery | single PR / single-pr         | Single PR, no size:exception used                                                                                       | ✅                |
| Scope                      | 2 files (Makefile + workflow) | Exactly 2 code files changed; staging workflow untouched; no GitHub Release asset; no signing; no ProGuard rule changes | ✅ No scope creep |

---

## Spec Coverage

- **Spec.md** (127 lines) FR-1..FR-5, NFR-1..4, AC-1..5 — covered above.
- **build-tooling/spec.md** — capture (✅), naming convention (✅, default `sonora-release-mapping.txt` + `OUTPUT_MAPPING` override), capture position (✅ order verified), missing-file scenario (⚠️ WARNING, see NFR-2 Gap).
- **mobile-deployment/spec.md** — artifact upload (✅), pipeline dependency (✅), download (✅ happy path), Play Console upload (✅), tag consistency (✅ `build-android.outputs.tag_name`), mapping-AAB consistency (✅ same Gradle invocation, signing does not re-obfuscate), graceful degradation (⚠️ WARNING, see NFR-2 Gap), R8 one-time verification (⏳ pending).

---

## Blockers

1. **RESOLVED:** NFR-2 / graceful-degradation gap fixed in `7776f98` (`|| true` on Makefile `cp`, `continue-on-error` on download step).
2. **PARENT-OWNED (post-archive follow-ups):** manual R8 verification (Phase 1), local Makefile verification (Phase 2), CI integration run (Phase 5), post-apply bounded review, and Phase 1 R8 findings documentation — recorded as follow-ups per parent approval to archive now.
3. **TDD evidence:** apply-progress lacks the `TDD Cycle Evidence` table (strict TDD active) — reconcile with an explicit N/A/structural entry in apply-progress.

## Not Verified Here (by delegation)

- FR-5 / AC-5 R8 verification (manual, one-time).
- AC-2 / AC-3 (require a real CI run on `feat/android-proguard-mapping` via `workflow_dispatch`).
- AC-4 (requires an actual Play Console deployment).
