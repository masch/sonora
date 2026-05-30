# Design: Setup Internationalization

## Technical Approach

Add typed i18n via i18next + react-i18next + expo-localization. Init is a side-effect import in `_layout.tsx` — no Provider wrapping. All 47+ strings externalized into a single `as const` object. ESLint rule prevents regressions.

**Locale detection flow:**

```
App starts → expo-localization.getLocales()
  → i18n.init({ lng: resolved, fallbackLng: 'en', compatibilityJSON: 'v3' })
  → i18next resolves language, falls back to 'en' if unsupported
  → Components call useTranslation() → t('explore.title')
```

**Pattern**: `useTranslation()` hook per-screen, `t()` calls in JSX. Tab labels via `useTranslation` in `app-tabs.tsx` instead of reading `TABS[].label` directly.

## Architecture Decisions

### Decision: i18next + react-i18next over alternatives

| Option                      | Tradeoff                                                 | Verdict |
| --------------------------- | -------------------------------------------------------- | ------- |
| `react-intl`                | Requires `<IntlProvider>`, heavier API, less RN-native   | ❌      |
| `expo-i18n` alone           | No translation engine, only locale detection             | ❌      |
| **i18next + react-i18next** | Most mature JS i18n, zero Provider overhead, Hermes-safe | ✅      |

### Decision: Typed `as const` objects over flat JSON

| Option                | Tradeoff                                                      | Verdict |
| --------------------- | ------------------------------------------------------------- | ------- |
| JSON files            | No type safety, no autocomplete, runtime only                 | ❌      |
| **`as const` object** | Derives `TranslationKeys` union type, compile-time key safety | ✅      |

### Decision: `compatibilityJSON: 'v3'` over disabling Hermes

| Option                        | Tradeoff                                                  | Verdict |
| ----------------------------- | --------------------------------------------------------- | ------- |
| Disable Hermes                | Loses perf, major config change                           | ❌      |
| **`compatibilityJSON: 'v3'`** | One flag, zero runtime diff for `en`, Hermes-safe plurals | ✅      |

### Decision: Tab labels via `useTranslation`

`TABS[].label` is a static constant — can't call a hook there. `app-tabs.tsx` already renders labels via `<NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>`. Replace with `t(\`tabs.${tab.name}\`)`. The `TABS`array keeps`name`, `ioniconsName`, `symbolViewName`but`label` is removed (no longer the source of truth).

## Key Naming Convention

Dot-separated: `{screen}.{section}.{element}` — e.g., `explore.title`, `home.hints.editing`, `settings.section.preferences`, `tabs.home`.

## File Changes

| File                          | Action     | Details                                                                               |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `src/i18n/index.ts`           | **Create** | i18next init with `expo-localization`, `compatibilityJSON: 'v3'`, `fallbackLng: 'en'` |
| `src/i18n/locales/en.ts`      | **Create** | `as const` object with all 47+ strings                                                |
| `src/i18n/types.ts`           | **Create** | `type TranslationKeys = RecursiveKeyOf<typeof en>`                                    |
| `package.json`                | Modify     | Add `i18next`, `react-i18next`, `expo-localization`, `eslint-plugin-i18next`          |
| `app.json`                    | Modify     | Add `"expo-localization"` to `expo.plugins`                                           |
| `src/app/_layout.tsx`         | Modify     | +1 line: `import '@/i18n'` (side-effect init)                                         |
| `src/constants/tabs.ts`       | Modify     | Remove `label` field from `TabDefinition` and `TABS` entries                          |
| `src/components/app-tabs.tsx` | Modify     | Import `useTranslation`, replace `tab.label` with `t(\`tabs.${tab.name}\`)`           |
| `src/components/hint-row.tsx` | Modify     | Add `useTranslation`, move defaults inside body                                       |
| `src/app/explore.tsx`         | Modify     | ~12 `t()` replacements: title, subtitle, collapsible titles, link labels              |
| `src/app/index.tsx`           | Modify     | ~7 `t()` replacements: title, section badge, hint-row titles                          |
| `src/app/settings.tsx`        | Modify     | ~15 `t()` replacements: header, section titles, row labels, footer                    |
| `eslint.config.js`            | Modify     | Add `eslint-plugin-i18next` with `markupOnly: true` + `allow` list                    |

## Migration Order

1. **Infrastructure** — `src/i18n/` (3 files), `package.json`, `app.json`, `_layout.tsx`
2. **Data** — `tabs.ts` + `app-tabs.tsx` (tab labels via hook)
3. **Components** — `hint-row.tsx` (defaults via `t()`)
4. **Screens** — `explore.tsx`, `index.tsx`, `settings.tsx` (all `t()` replacements)
5. **Lint** — `eslint.config.js` (final, after migration so it doesn't block work)

## Testing Strategy

| Layer       | What                                     | How                                                                              |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| Unit        | i18n init with `expo-localization` mock  | Verify `i18next.language` resolves to fallback, `compatibilityJSON` flag set     |
| Unit        | `en.ts` key completeness                 | Iterate all keys, assert each is non-empty string — catches missing translations |
| Integration | Screen renders with `t()`                | Wrap in `I18nextProvider`, query by text content matches key values              |
| Lint        | `eslint-plugin-i18next` catches literals | Add test case in ESLint config validation                                        |

## In-App Language Switcher

The Settings screen has a "Language" row showing `"English"`. Out of scope for this change (per proposal) — no toggle functionality. But add the `t('settings.preferences.language')` and `t('settings.language.label')` keys so the row is externalized. The row remains static.

## Delivery Strategy Forecast

- **New lines**: ~150 (3 i18n files + deps)
- **Modified lines**: ~180 across 8 files
- **Total**: ~330 — under 400-line PR budget
- **Decision**: Single PR, no chaining needed
- **Risk**: Low — pure refactor with ESLint guard

## Open Questions

- None — spec and proposal are comprehensive.
