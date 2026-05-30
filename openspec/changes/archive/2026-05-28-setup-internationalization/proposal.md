# Proposal: Setup Internationalization

## Intent

47+ user-facing strings are hardcoded across screens and components. This blocks localization for Spanish and makes future languages a manual hunt-and-replace. Add a typed i18n layer to externalize all strings with zero runtime overhead.

## Scope

**In scope**: i18next + react-i18next + expo-localization integration, full `en` translation keyfile, `compatibilityJSON: 'v3'` for Hermes, ESLint rule (`eslint-plugin-i18next`), `@/i18n` import in `_layout.tsx`.

**Out of scope**: Non-English locale files, RTL support, in-app language switcher, runtime language switching (sets on launch via device locale).

## Capabilities

### New

- `internationalization`: Externalized strings with locale detection and typed translation keys. Infrastructure-only — no new user-facing feature.

### Modified

- None — pure refactor, no behavioral spec change.

## Approach

1. Install `i18next`, `react-i18next`, `expo-localization`, `eslint-plugin-i18next`
2. `src/i18n/index.ts` — init with expo-localization locale, `compatibilityJSON: 'v3'`, fallback `'en'`
3. `src/i18n/locales/en.ts` — `as const` object with all strings; `src/i18n/types.ts` — extract `TranslationKeys` type
4. Import `@/i18n` once in `src/app/_layout.tsx`
5. Replace hardcoded strings with `t('ns:key')` in all screens + tab labels + hint-row defaults + collapsible titles
6. Add `i18next/no-literal-string` to `eslint.config.js`

**Hermes note**: Expo SDK 56 defaults to Hermes (no `Intl`). `compatibilityJSON: 'v3'` is a one-line i18next flag — no functional difference for plural handling.

## Affected Areas

| Area                          | Change        | What                        |
| ----------------------------- | ------------- | --------------------------- |
| `src/i18n/`                   | New (3 files) | Init, en.ts, types.ts       |
| `src/app/_layout.tsx`         | +1 line       | Import `@/i18n`             |
| `src/app/explore.tsx`         | ~12 strings   | t() replacements            |
| `src/app/index.tsx`           | ~7 strings    | t() replacements            |
| `src/app/settings.tsx`        | ~15 strings   | t() replacements            |
| `src/constants/tabs.ts`       | ~3 labels     | t() replacements            |
| `src/components/hint-row.tsx` | ~2 defaults   | t() replacements            |
| `eslint.config.js`            | 1 rule        | `i18next/no-literal-string` |

## Risks

| Risk                                            | Likelihood | Mitigation                                 |
| ----------------------------------------------- | ---------- | ------------------------------------------ |
| expo-localization crash on unsupported platform | Low        | try/catch, fallback `'en'`                 |
| ESLint rule too aggressive                      | Med        | Configure `allow` list for code/file paths |
| Missing string during migration                 | Med        | ESLint catches remaining literals          |

## Rollback Plan

Revert single commit. ESLint rule can be commented out independently.

## Dependencies

`i18next`, `react-i18next`, `expo-localization`, `eslint-plugin-i18next`.

## Success Criteria

- [ ] i18n init logs no warnings, auto-detects device locale
- [ ] All 47+ strings externalized — zero hardcoded user-facing strings remain
- [ ] ESLint rule catches new literal strings in JSX text content
- [ ] App renders identically before and after (no visual regression)
