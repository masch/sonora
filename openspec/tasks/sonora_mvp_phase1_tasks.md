# Tasks: Sonora MVP Phase 1 Execution

This document maps out the specific execution steps and commit roadmap for implementing Phase 1 Core Services.

---

## 1. Commit and Branch Strategy

- **Branch:** `feat/mvp-phase1-core`
- **Workflow:** Commits must be small, isolated, and structured using Conventional Commits scope rules. Tests must pass locally after each commit.

---

## 2. Checklist Roadmap

- [x] **Task 1: Math utility setup**
  - Create the Haversine distance calculator helper.
  - _Files:_ [NEW] `src/utils/haversine.ts`, [NEW] `src/utils/__tests__/haversine.test.ts`
  - _Commit:_ `feat(utils): add haversine formula distance helper with tests`

- [x] **Task 2: Geofencing state hook**
  - Implement GPS coordinate matching and accuracy-latency warning trigger.
  - _Files:_ [NEW] `src/hooks/use-offline-geofence.ts`, [NEW] `src/hooks/__tests__/use-offline-geofence.test.ts`
  - _Commit:_ `feat(hooks): implement useOfflineGeofence hook with precision indicators`

- [x] **Task 3: Download manager state hook**
  - Build disk space checker and FileSystem background download manager.
  - _Files:_ [NEW] `src/hooks/use-trip-download.ts`, [NEW] `src/hooks/__tests__/use-trip-download.test.ts`
  - _Commit:_ `feat(hooks): implement useTripDownload hook with space limits`

- [ ] **Task 4: Background audio player hook**
  - Implement Audio exclusive focus and hardware unplug triggers.
  - _Files:_ [NEW] `src/hooks/use-immersion-player.ts`, [NEW] `src/hooks/__tests__/use-immersion-player.test.ts`
  - _Commit:_ `feat(hooks): implement useImmersionPlayer hook with exclusive focus`

- [ ] **Task 5: Presentational UI Components**
  - Create the Tailwind-styled cards for download tracking, player control overlays, and GPS quality pills.
  - _Files:_ [NEW] `src/components/download-progress-card.tsx`, [NEW] `src/components/gps-precision-badge.tsx`, [NEW] `src/components/audio-media-controls.tsx`
  - _Commit:_ `feat(components): add download card, gps badge and media controls UI`

- [ ] **Task 6: Trip Detail Screen Integration**
  - Assemble all services on `src/app/trips/[id].tsx` container view.
  - _Files:_ [NEW] `src/app/trips/[id].tsx`, [NEW] `src/app/trips/__tests__/[id].test.tsx`
  - _Commit:_ `feat(trips): integrate download, geofence and player on trip detail screen`

---

## 3. Review Workload Forecast

- **Estimated lines changed:** ~350 lines of code.
- **Complexity rating:** Medium (primarily local state and native Expo bridges).
- **Chained PRs recommended:** No, can be reviewed in a single focused PR targeting `main`.
