# Design: Add Makefile EAS Deployment Targets

## Technical Approach

Add a `Deploy` section to the Makefile (between Review and Maintenance) with `eas-*` targets that wrap EAS CLI commands via `bunx`, and create `eas.json` with two build profiles (production, preview). The targets use `eas-whoami` as a prerequisite dependency to fail early if not authenticated. Web deployment uses a two-step process (`expo export` + `eas deploy`) because `eas deploy` is still a preview feature and explicit export gives us control over the output.

## Architecture Decisions

### Decision: New "Deploy" section placement

| Option                           | Tradeoff                                           | Decision    |
| -------------------------------- | -------------------------------------------------- | ----------- |
| After Review, before Maintenance | Flow: dev → test → CI → review → deploy → clean    | ✅ Chosen   |
| Inline in existing sections      | Scatters deploy concerns, breaks section semantics | ❌ Rejected |

**Rationale**: The Makefile sections follow the dev lifecycle order. Deploy logically comes after code review and before cleanup. A single "Deploy" section groups all EAS targets together.

### Decision: `eas-whoami` as build target dependency

| Option                            | Tradeoff                                       | Decision    |
| --------------------------------- | ---------------------------------------------- | ----------- |
| Prerequisite dep on build targets | Fails fast before build starts, clear feedback | ✅ Chosen   |
| Implicit (user must run first)    | Silent failures mid-build, worse DX            | ❌ Rejected |

**Rationale**: Make's dependency chain fails immediately if `eas-whoami` exits non-zero. This means a missing or expired `EXPO_TOKEN` is caught before the (slow) build process begins.

### Decision: Two-step web deploy (`expo export` + `eas deploy`)

| Option                          | Tradeoff                                         | Decision    |
| ------------------------------- | ------------------------------------------------ | ----------- |
| `eas deploy` alone              | Simpler, but less control over export phase      | ❌ Rejected |
| `expo export` then `eas deploy` | Explicit export, works with preview `eas deploy` | ✅ Chosen   |

**Rationale**: `eas deploy` is documented as a preview feature. Separating the export step gives us visibility into failures at each stage and makes it easy to inspect the web build output before deployment.

### Decision: `eas-*` prefix for target names

| Option         | Tradeoff                                    | Decision    |
| -------------- | ------------------------------------------- | ----------- |
| `eas-*` prefix | Self-documenting, searchable, no collisions | ✅ Chosen   |
| `deploy-*`     | More abstract, hides which tool is used     | ❌ Rejected |

**Rationale**: Consistent with the rest of the Makefile where target names describe the tool (`gga`, `doctor`, etc.). `eas-` makes it obvious which CLI is invoked.

### Decision: Separate production/preview profiles

| Profile      | Use case         | Distribution | Build type |
| ------------ | ---------------- | ------------ | ---------- |
| `production` | Release builds   | — (store)    | APK        |
| `preview`    | Internal testing | `internal`   | APK        |

**Rationale**: Two profiles are sufficient for the current workflow. `production` generates a signed APK for Play Store. `preview` uses `distribution: "internal"` for EAS Build's internal distribution (QR code installs). Both produce APK to keep it simple — no AAB until Play Store submission is ready.

## File Changes

| File       | Action | Description                                                               |
| ---------- | ------ | ------------------------------------------------------------------------- |
| `eas.json` | Create | Build profiles for production (store) and preview (internal distribution) |
| `Makefile` | Modify | Add "Deploy" section with 4 EAS targets after "Review" section            |

## Targets

```makefile
# ── Deploy ──────────────────────────────────────

.PHONY: eas-whoami
eas-whoami: ## Verify EAS login status (requires EXPO_TOKEN in .env)
	bunx eas whoami

.PHONY: eas-build-android
eas-build-android: eas-whoami ## Build Android APK (production profile)
	bunx eas build -p android --profile production --wait

.PHONY: eas-build-android-preview
eas-build-android-preview: eas-whoami ## Build Android APK for internal distribution
	bunx eas build -p android --profile preview --wait

.PHONY: eas-build-web
eas-build-web: eas-whoami ## Export web build and deploy via EAS Hosting
	bunx expo export --platform web && bunx eas deploy --prod
```

## Dependencies

| Dependency              | Status               | Notes                                                              |
| ----------------------- | -------------------- | ------------------------------------------------------------------ |
| `EXPO_TOKEN` in `.env`  | ✅ Already exists    | Used for non-interactive EAS auth                                  |
| `bunx eas` in PATH      | ✅ Already exists    | Located at `/home/masch/.bun/bin/eas`, resolved via bunx           |
| `eas project:init`      | ❌ Must run manually | Run `bunx eas init` once before first build — links to EAS project |
| EAS project on exp.host | ❌ Must create once  | Create via `expo.dev` dashboard or `eas init`                      |

**Important**: `eas.json` alone is not enough — the project must be initialized with EAS via `bunx eas init` before builds work. This creates the project on exp.host and generates the necessary `.eas/` directory. Document this in the help text or README.

## Error Handling

| Scenario                     | Behavior                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| `EXPO_TOKEN` missing/expired | `eas-whoami` fails → build targets never run (Make dep fail) |
| EAS project not initialized  | `eas build` fails with "project not linked" error at runtime |
| Build fails (Android)        | `eas build --wait` exits non-zero → Make propagates failure  |
| `expo export` fails (web)    | `&&` short-circuits → `eas deploy` never runs                |
| `eas deploy` fails (web)     | Chain exits non-zero → Make shows error                      |
| EAS CLI outdated             | `bunx eas` resolves latest, but may prompt for update        |

The `eas-whoami` dependency gate ensures auth failures are caught immediately, not after a 10+ minute build. The web two-step `&&` chain ensures we never deploy a broken export.

## Testing Strategy

| Layer        | What                              | How                                               |
| ------------ | --------------------------------- | ------------------------------------------------- |
| Verification | `eas.json` syntax                 | `bunx eas build:version:get` parses it correctly  |
| Auth check   | `make eas-whoami`                 | Run with valid and invalid `EXPO_TOKEN`           |
| Dry run      | `make eas-build-android` (dry)    | Add `--dry` flag variant or just inspect Makefile |
| Web export   | `make eas-build-web` up to export | Run `bunx expo export --platform web` standalone  |
| Full deploy  | `make eas-build-web`              | Requires EAS project init + valid EXPO_TOKEN      |

No unit tests — these are Makefile targets that shell out to CLI tools. Verification is manual via `make` invocation and inspecting exit codes.

## Migration / Rollout

No migration required. No existing targets change behavior. `eas.json` is a new file — no risk to existing workflow. The `eas init` step is a one-time manual prerequisite.

## Open Questions

- [ ] Should we add a `--dry` variant for `eas-build-android` to validate the config without going through a full build?
- [ ] Should `eas-build-web` include `--no-wait` flag for async deploys, or is `--wait` (implied by default) preferred for local dev?
