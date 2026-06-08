# Proposal: Fix EAS Android Build — Mislabeled JPEG/PNG Assets

## Intent

EAS Android release builds fail because AAPT2 rejects `deriva-centro.png` and `bonus-track.png` — both are JPEG image data with `.png` extensions. Dev builds work (Metro serves assets directly), but Android deployment is blocked.

## Scope

### In Scope

- Convert `assets/images/sonora/deriva-centro.png` from JPEG → true PNG via ImageMagick
- Convert `assets/images/sonora/bonus-track.png` from JPEG → true PNG via ImageMagick

### Out of Scope

- Renaming files to `.jpg` (would require code changes in `trip-map.tsx`)
- Converting to WebP or any other format
- Bulk audit of all remaining assets (19 genuine PNGs confirmed)
- Configuration changes to `eas.json`, `app.config.ts`, or `metro.config.js`

## Capabilities

### New Capabilities

None — no spec-level changes introduced.

### Modified Capabilities

None — pure asset fix, no behavior or spec changes.

## Approach

1. Run ImageMagick `convert` on each file to re-encode JPEG data as true PNG
2. Verify with `file` command that output reports "PNG image data"
3. Run `make validate` (lint + typecheck) — expect no failures since no code changes
4. Build locally with `eas build --platform android --local` to confirm AAPT2 passes

```bash
convert assets/images/sonora/deriva-centro.png png:assets/images/sonora/deriva-centro.png
convert assets/images/sonora/bonus-track.png png:assets/images/sonora/bonus-track.png
```

## Affected Areas

| Area                                     | Impact   | Description               |
| ---------------------------------------- | -------- | ------------------------- |
| `assets/images/sonora/deriva-centro.png` | Modified | JPEG → true PNG re-encode |
| `assets/images/sonora/bonus-track.png`   | Modified | JPEG → true PNG re-encode |

## Risks

| Risk                                 | Likelihood     | Mitigation                                                                           |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------------------ |
| ImageMagick not installed            | Low            | Use `apt install imagemagick` or Docker if absent                                    |
| Visual quality loss from re-encoding | Low            | ImageMagick's PNG encoder is lossless from source PNG-like data; verify side-by-side |
| Git diff shows binary blob           | Low (expected) | Binary change is unavoidable; commit message documents intent                        |

## Rollback Plan

```bash
git checkout HEAD -- assets/images/sonora/deriva-centro.png assets/images/sonora/bonus-track.png
```

Revert is a single `git checkout` — no code changes to unwind.

## Dependencies

- ImageMagick (`convert` command) — install via `apt install imagemagick` if missing

## Success Criteria

- [ ] `file assets/images/sonora/deriva-centro.png` reports `PNG image data`
- [ ] `file assets/images/sonora/bonus-track.png` reports `PNG image data`
- [ ] `make validate` passes (lint + typecheck)
- [ ] `eas build --platform android --local` completes without AAPT2 errors
- [ ] Visual comparison confirms no quality regression against originals
