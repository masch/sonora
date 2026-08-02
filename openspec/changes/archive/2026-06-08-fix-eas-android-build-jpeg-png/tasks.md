# Tasks: Fix EAS Android Build — Mislabeled JPEG/PNG Assets

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Suggested Work Units

| Unit | Goal                                        | Likely PR | Notes                               |
| ---- | ------------------------------------------- | --------- | ----------------------------------- |
| 1    | Convert 2 JPEG-as-PNG files to genuine PNGs | Single PR | Zero code changes. Binary-only fix. |

## Phase 1: Asset Conversion

- [x] 1.1 Run `convert assets/images/sonora/deriva-centro.png png:assets/images/sonora/deriva-centro.png` via ImageMagick
- [x] 1.2 Run `convert assets/images/sonora/bonus-track.png png:assets/images/sonora/bonus-track.png` via ImageMagick

## Phase 2: Verification

- [x] 2.1 Run `file assets/images/sonora/*.png` — confirm both report `PNG image data`
- [x] 2.2 Run `make validate` — confirm lint + typecheck pass (no regressions expected)
- [x] 2.3 Run `eas build --platform android --local` — confirm AAPT2 no longer rejects assets
- [x] 2.4 Visual side-by-side comparison against git stash originals — confirm no quality loss

## Rollback

```bash
git checkout HEAD -- assets/images/sonora/deriva-centro.png assets/images/sonora/bonus-track.png
```

Single `git checkout` reverts both files. No code changes to unwind.
