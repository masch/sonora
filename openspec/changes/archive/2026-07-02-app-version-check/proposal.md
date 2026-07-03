# Proposal: App Version Check

## Intent

Sonora has no version gating — old clients hit broken UX silently. Add a config-driven gate at startup: warn or block, controlled remotely.

## Scope

### In Scope

- Extend `RemoteConfigPayloadSchema` with `appVersion` section
- API reads `MINIMUM_APP_VERSION`, `BLOCK_OLDER_VERSIONS`, `GRACE_PERIOD_DAYS` from env vars
- `useRemoteConfigStore` runs semver comparison, exposes `versionStatus: 'ok' | 'warn' | 'block'`
- Root layout renders block modal (non-dismissable) or warning banner (dismissable)
- Inline semver `gte()` in shared — no new dependency
- i18n strings (en + es), tests for all layers

### Out of Scope

- Store links ("download latest" text only), API middleware gating, build-system auto-detection, DB persistence

## Capabilities

### New: `app-version-check` — enforce minimum version at startup (warn/block/grace)

### Modified: `mobile-config` (payload gains `appVersion`), `api` (config response shape changes)

## Approach

Extend the existing config pipeline end-to-end. API reads 3 env vars into a new `appVersion` object in the config payload. Shared Zod schema validates fields. `useRemoteConfigStore` compares `Constants.expoConfig.version` against `minimumVersion` via inline `gte()`, sets `versionStatus`, caches verdict. `_layout.tsx` checks `versionStatus` and renders full-screen modal (block) or banner (warn). Grace period tracked via local-storage timestamp — within window, block downgrades to warn.

## Affected Areas

`shared/src/schemas/config.ts` (add appVersion) · `shared/src/semver.ts` (new gte) · `api/src/index.ts` (Env vars) · `api/src/routes/config.ts` (return version) · `api/wrangler.toml` ([vars]) · `store/remote-config-store.ts` (version check) · `app/_layout.tsx` (UI integration) · `components/update-required-modal.tsx` (new) · `components/update-warning-banner.tsx` (new) · `i18n/locales/{en,es}.ts`

## Risks

- **Offline first-launch**: no cache → skip check (med). Mitigation: next online launch runs it
- **Semver edge cases**: pre-release, odd patches (low). Inline `gte()` covers common cases; invalid → `ok`
- **Config cache poisoning**: (low). Re-validate on every online init
- **Grace period resets on reinstall**: (low). Acceptable

## Rollback Plan

- **Soft**: Set `BLOCK_OLDER_VERSIONS=false` or lower `MINIMUM_APP_VERSION` — instant deploy, no code revert
- **Hard**: Revert files, redeploy API + mobile (expo-updates OTA or store update)

## Dependencies

`Constants.expoConfig.version` (expo-constants, already present). No new npm packages.

## Success Criteria

- [ ] `MINIMUM_APP_VERSION > appVersion` shows block/warning at startup
- [ ] Sufficient version → no UI
- [ ] Grace period suppresses block for configured duration
- [ ] Offline first-launch with no cache → normal launch
- [ ] All tests pass, i18n renders in en + es
