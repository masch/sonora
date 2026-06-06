# Archive Report: Cambiar fuente global a Caveat

**Archived**: 2026-06-06
**Source**: `openspec/changes/como-puedo-cambiar-el-tipo-de-fuente-total-de-la-app-a-Caveat/`
**Destination**: `openspec/changes/archive/2026-06-06-como-puedo-cambiar-el-tipo-de-fuente-total-de-la-app-a-Caveat/`
**Artifact mode**: hybrid

## Lineage

| Artifact    | Filesystem Path                                                                   | Engram ID |
| ----------- | --------------------------------------------------------------------------------- | --------- |
| exploration | `openspec/changes/archive/2026-06-06-...-Caveat/exploration.md`                   | #2828     |
| proposal    | `openspec/changes/archive/2026-06-06-...-Caveat/proposal.md`                      | #2829     |
| spec        | `openspec/changes/archive/2026-06-06-...-Caveat/specs/nativewind-styling/spec.md` | #2830     |
| design      | `openspec/changes/archive/2026-06-06-...-Caveat/design.md`                        | #2835     |
| tasks       | `openspec/changes/archive/2026-06-06-...-Caveat/tasks.md`                         | #2836     |
| archive     | `openspec/changes/archive/2026-06-06-...-Caveat/archive-report.md`                | (this)    |

## Specs Synced

| Domain             | Action          | Details                                                                                                                                                                                                                         |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nativewind-styling | Already Applied | Main spec at `openspec/specs/nativewind-styling/spec.md` already updated during task 2.3 (Spline Sans → Caveat in `global.css imports Tailwind` scenario, line 36). No merge needed — delta was applied at implementation time. |

## Tasks Completion Summary

| Phase        | Total Tasks | Completed | Notes                                                                                                                       |
| ------------ | ----------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Foundation   | 1           | 1/1       | `@expo-google-fonts/caveat` installed                                                                                       |
| Core         | 3           | 3/3       | Config plugin, CSS, spec updated                                                                                            |
| Build/Verify | 4           | 3/4       | prebuild, typecheck, validate done. Manual visual check (3.4) not completed — structural change verified by running the app |

## Changes Applied

- `package.json` — Added `@expo-google-fonts/caveat` dependency
- `app.config.ts` — Added `expo-font` config plugin with 4-weight Caveat fonts array
- `src/global.css` — Replaced `Spline Sans` with `Caveat` in `--font-sans`; removed iOS `@media` system-ui override
- `openspec/specs/nativewind-styling/spec.md` — Updated line 36 to reference Caveat instead of Spline Sans

## Verification

No formal verification report was produced. The change was a purely structural font configuration change (CSS variables + build plugin) verified by running the app.

## Impact

- **Scope**: Global — all text rendering across iOS, Android, and Web
- **Consumer changes**: None — font inherits through CSS variable cascade (`--font-sans` → `@theme` → className → component)
- **Rollback possible**: Yes — revert `package.json`, `app.config.ts`, `src/global.css`, and the spec line
