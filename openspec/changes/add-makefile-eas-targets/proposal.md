## Proposal: Add Makefile targets for EAS deployment

### Intent

Add Makefile targets for EAS-based deployment: Android (EAS Build) and Web (EAS Deploy). Introduce an `eas.json` with build profiles for production and preview.

### Scope

#### In Scope

- Create `eas.json` with `production` and `preview` build profiles
- Add `eas-whoami` target → `eas whoami`
- Add `eas-build-android` target → `eas build -p android --profile production --wait`
- Add `eas-build-android-preview` target → `eas build -p android --profile preview --wait`
- Add `eas-build-web` target → `bunx expo export --platform web && eas deploy --prod`
- All targets under new `# ── EAS Deploy ──` section in Makefile, following `.PHONY` + `##` convention
- EAS CLI at `/home/masch/.bun/bin/eas` (v18.6.0), invoked via PATH

#### Out of Scope

- iOS builds (development or production)
- CI/CD workflows (GitHub Actions, etc.)
- Automatic submission to stores
- EAS Update (OTA updates)
- EAS Build credentials configuration

### Key Decisions

- Use `bunx expo export --platform web` (not `eas build`) for web deployment — EAS Deploy expects an already-exported static build
- Use `eas build` (bare CLI) for Android, not `bunx eas` — `eas` is globally installed
- `eas.json` uses APK build type (not AAB) for both profiles
- Authentication via `EXPO_TOKEN` in `.env` — no interactive login in Makefile targets

### Risks

- Low: Developer without `EXPO_TOKEN` gets auth error from `eas whoami` — clear error message from EAS CLI, no silent failure
- Low: First-time EAS project setup needs `eas init` or `eas build:configure` — the target fails with a helpful EAS error
- Low: Web export before `eas deploy` doubles build time — acceptable tradeoff for correctness

### Ready for Spec

Yes.
