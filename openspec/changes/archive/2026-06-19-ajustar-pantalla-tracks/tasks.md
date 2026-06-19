# Tasks: Adapt tracks screen to match design mockup

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | 300-380        |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | ask-on-risk    |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

- [x] Create mock data for tracks in `src/data/tracks.ts`
- [x] Add localization strings for Tracks screen in Spanish and English locales
- [x] Implement search bar and category filters in `src/app/(tabs)/tracks.tsx`
- [x] Implement track list rendering with filtration logic in `src/app/(tabs)/tracks.tsx`
- [x] Write unit tests verifying render, filtering, and search in `src/__tests__/tracks.test.tsx`
- [x] Run linter, type-check, and tests to verify correctness
