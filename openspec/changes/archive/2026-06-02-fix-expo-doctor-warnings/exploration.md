# Exploration: fix-expo-doctor-warnings

## Current State

`expo-doctor@1.19.8` fails with 3 checks out of 21:

### 1. Non-square icons (3 files)

| File                                        | Current Dims | Required                 | Role                                                |
| ------------------------------------------- | ------------ | ------------------------ | --------------------------------------------------- |
| `assets/images/icon.png`                    | 2156×1952    | square                   | `app.json` → `expo.icon`                            |
| `assets/images/android-icon-foreground.png` | 2156×1952    | square                   | `app.json` → `android.adaptiveIcon.foregroundImage` |
| `assets/images/android-icon-monochrome.png` | 2156×1952    | square                   | `app.json` → `android.adaptiveIcon.monochromeImage` |
| `assets/images/android-icon-background.png` | 512×512      | square ✅                | passes                                              |
| `assets/images/splash-icon.png`             | 2156×1952    | (not in icon validation) | splash plugin only                                  |

All failed icons are the **same source image** at 2156×1952 — likely exported at wrong aspect ratio or distorted.

### 2. Missing `expo-asset` peer dependency

- `expo-audio@56.0.11` declares `expo-asset: "*"` as a peer dependency
- `expo-asset@56.0.14` is **already installed** in `node_modules` (as transitive dep of both `expo@56.0.4` and `expo-audio`)
- BUT it is **not listed** in `package.json` dependencies, so `expo doctor` flags it

### 3. Patch version mismatches (5 packages)

| Package          | Expected   | Found     | Delta      |
| ---------------- | ---------- | --------- | ---------- |
| `@expo/ui`       | `~56.0.15` | `56.0.13` | +2 patches |
| `expo`           | `~56.0.8`  | `56.0.4`  | +4 patches |
| `expo-constants` | `~56.0.16` | `56.0.15` | +1 patch   |
| `expo-linking`   | `~56.0.13` | `56.0.11` | +2 patches |
| `expo-router`    | `~56.2.8`  | `56.2.6`  | +2 patches |

All within SDK 56 range — pure patch bumps, no breaking changes expected.

## Affected Areas

- `assets/images/icon.png` — non-square, needs resize/pad
- `assets/images/android-icon-foreground.png` — non-square, needs resize/pad
- `assets/images/android-icon-monochrome.png` — non-square, needs resize/pad
- `app.json` — references these icon paths (no config change needed, just fixing the actual files)
- `package.json` — needs `expo-asset` added as explicit dependency; needs 5 version bumps
- `node_modules/` — will be updated by `expo install`

## Approaches

### Icons — 3 options

#### A1. Resize + pad to square with ImageMagick (RECOMMENDED)

Use `magick` to resize the long edge to 1024 and pad the shorter edge with transparency to reach 1024×1024. Since all 3 icons are the same source at 2156×1952, generate 1024×1024 square icons preserving the original image content without cropping visible elements.

- **Pros**: Fast, scriptable, lossless quality preservation via padding
- **Cons**: May produce letterboxing if original subject extends to edges
- **Effort**: Low (single shell command)
- **Tools available**: `magick` (ImageMagick v7), Pillow (Python)

#### A2. Create proper square icons from source assets

If the project has a canonical square source (e.g., design file) or if the 2156×1952 source has a well-centered subject.

- **Pros**: Can produce better visual result with proper centering
- **Cons**: Requires identifying best crop region; no evidence of a separate square source
- **Effort**: Low-Medium (manual inspection + command)

#### A3. Generate via Expo PWA icon generator

Use `npx expo pwa-icon generate` or similar Expo-provided tooling.

- **Pros**: Official Expo toolchain
- **Cons**: `expo pwa-icon` is deprecated in SDK 51+; not available in SDK 56; requires additional setup
- **Effort**: High (research + setup + might not work)

### Missing dependency — 1 option

#### B1. `npx expo install expo-asset`

One command. Installs the correct version compatible with SDK 56, adds it to `package.json`.

- **Effort**: Minimal

### Version mismatches — 1 option

#### C1. `npx expo install --check`

Interactive upgrade. Shows differences and upgrades each package. Alternatively `npx expo install <pkg>@<version>` per package.

- **Effort**: Minimal (single command)
- **Risk**: MUST verify all tests pass after upgrade

## Recommendation

Execute the fix in this order:

1. **Fix icons** — Use `magick` to resize+pad the 3 non-square icons to 1024×1024 (standard Expo icon size)
2. **Add expo-asset** — `npx expo install expo-asset`
3. **Bump versions** — `npx expo install --check` (or individual bumps)
4. **Verify** — Run `make validate` (format → test → lint → typecheck → GGA), then `npx expo-doctor` to confirm all 21 checks pass

All 3 fixes are orthogonal — can be done in any order, no conflicts.

## Risks

- **Icon padding**: If the icon subject extends close to the edge (2156 is wider than 1952 is tall), padding the sides to make it square may look odd. Inspect the images first.
- **Version bumps**: Expo core upgrade (56.0.4 → 56.0.8) is safe as same SDK line, but run full validation to catch any regressions.
- **expo-asset**: Already installed at correct version (56.0.14), so only needs `package.json` entry. No runtime risk.
- **TDD gate**: `make validate` includes `eslint`, `tsc --noEmit`, `jest`, GGA — any of these could fail after changes. Specify how to handle.

## Ready for Proposal

**Yes** — all issues are well-understood, fixes are straightforward and low-risk.
