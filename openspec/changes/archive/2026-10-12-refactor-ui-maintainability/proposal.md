# Proposal: refactor-ui-maintainability

## Intent

Resolve 8 maintainability warnings introduced by `react-doctor` v0.9.17 across mobile UI components without adding suppression rules to `doctor.config.ts`.
Reduce cyclomatic complexity by decoupling orchestration logic into focused custom hooks and eliminating duplicated JSX subtrees into dedicated presentational subcomponents.

## Capabilities

| Who         | Can do                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| Developer   | Runs `make doctor` and gets 100/100 score with 0 warnings on mobile codebase.             |
| User        | Experiences identical audio playback, navigation, and modal behavior without regressions. |
| CI Pipeline | Passes `validate-mobile` step in GitHub Actions with `--blocking warning` enforced.       |

## Scope

**In scope**:

- **Duplicate JSX (`react-doctor/duplicate-jsx-subtree`)**:
  - `apps/mobile/src/app/(tabs)/explore.tsx`: Extract banner header component.
  - `apps/mobile/src/components/track-detail-view.tsx`: Unify web/native conditional wrapper.
- **High Control-Flow Complexity (`react-doctor/no-high-complexity-react-function`)**:
  - `apps/mobile/src/components/audio-media-controls.tsx`: Extract playback rate and action control hooks/subcomponents.
  - `apps/mobile/src/components/feedback-form.tsx`: Extract `useFeedbackForm` state hook.
  - `apps/mobile/src/components/global-audio-player.tsx`: Extract mini-player playback orchestration hook.
  - `apps/mobile/src/components/screen-wrapper.tsx`: Simplify wrapper conditional layout branches.
  - `apps/mobile/src/components/track-detail-view.tsx`: Decompose track detail view into presentational sections.
  - `apps/mobile/src/components/trip-detail-view.tsx`: Decompose trip detail view into presentational sections.
- **Unit / Characterization Tests**:
  - Run existing test suites in `apps/mobile/src/__tests__/` to guarantee zero behavior regressions.

**Out of scope**:

- Adding rule suppressions or overrides to `apps/mobile/doctor.config.ts`.
- Changes to API, shared package, or database schemas.
- UI redesign or altering visual appearance/styles.

## Approach

1. **Characterization Verification**: Run existing test suites to establish baseline green status.
2. **Phase 1 — Eliminate JSX Duplication**: Extract `ExploreBanner` and clean up `TrackDetailView` root wrapper.
3. **Phase 2 — Custom Hook Extraction**: Decouple logic branches into dedicated custom hooks for `feedback-form`, `audio-media-controls`, and `global-audio-player`.
4. **Phase 3 — View Decomposition**: Break monolithic render methods in `track-detail-view`, `trip-detail-view`, and `screen-wrapper` into focused subcomponents.
5. **Phase 4 — Verification**: Validate with `make doctor` (score 100/100), `make test-front`, `make lint`, and `make typecheck`.

## Success Criteria

- [ ] `cd apps/mobile && bun run doctor --verbose --scope full -y --blocking warning` passes with code 0 (Score: 100/100, 0 issues).
- [ ] Monorepo tests (`make test-front`, `make test-shared`) pass with 0 failures.
- [ ] `make lint` and `make typecheck` pass with 0 errors.
- [ ] No exception added to `apps/mobile/doctor.config.ts`.
