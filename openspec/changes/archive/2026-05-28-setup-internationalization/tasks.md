# Tasks: Setup Internationalization

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330 (150 new + 180 modified across 11 files) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Infrastructure — i18n Core (3 new files + deps + init)

- [x] 1.1 Install deps: `bun add i18next react-i18next expo-localization && bun add -d eslint-plugin-i18next`
- [x] 1.2 Register `expo-localization` plugin in `app.json` under `expo.plugins`
- [x] 1.3 Create `src/i18n/locales/en.ts` — `as const` object with all 47+ strings using `{screen}.{section}.{element}` convention
- [x] 1.4 Create `src/i18n/types.ts` — derive `TranslationKeys` union type from `typeof en` via `RecursiveKeyOf`
- [x] 1.5 Create `src/i18n/index.ts` — i18next init with `expo-localization`, `fallbackLng: 'en'`
- [x] 1.6 Add `import '@/i18n'` side-effect import in `src/app/_layout.tsx`

## Phase 2: Data — Tab Label Migration

- [x] 2.1 Remove `label` field from `TabDefinition` and all `TABS` entries in `src/constants/tabs.ts`
- [x] 2.2 Add `useTranslation` in `src/components/app-tabs.tsx` and `app-tabs.web.tsx`, replace `tab.label` with `t(\`tabs.${tab.name}\`)`

## Phase 3: Components — HintRow Migration

- [x] 3.1 Add `useTranslation` in `src/components/hint-row.tsx`, replace default title/hint prop values with `t('index.hintRow.title')` and `t('index.hintRow.hint')`

## Phase 4: Screens — String Replacement

- [x] 4.1 `src/app/explore.tsx` — replace ~12 hardcoded strings with `t()` calls using Trans for inline-code segments
- [x] 4.2 `src/app/index.tsx` — replace ~7 hardcoded strings with `t()` calls (including platform-specific dev menu hints)
- [x] 4.3 `src/app/settings.tsx` — replace ~15 hardcoded strings with `t()` calls (header, section titles, row labels, footer, language row)

## Phase 5: Lint — ESLint Enforcement

- [x] 5.1 Add `eslint-plugin-i18next` with `i18next/no-literal-string` rule, `markupOnly: true`, and `allow` list for non-user-facing strings in `eslint.config.js`

## Phase 6: Verification

- [x] 6.1 Run `make typecheck` — no TS errors
- [x] 6.2 Run `make lint` — 0 errors, 16 warnings (all expected: test strings, technical paths, version prefix)
- [x] 6.3 Run `make test` — 43/43 tests pass
- [x] 6.4 Import audit: only `_layout.tsx` imports `@/i18n`
