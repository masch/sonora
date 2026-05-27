# Proposal: NativeWind Tabs Setup

## Intent

Add NativeWind v5 preview + Tailwind CSS v4 to enable className-based styling for all future screens, and demonstrate it works by adding a 3rd tab (Settings) styled with NativeWind across iOS, Android, and Web.

## Scope

### In Scope
- Install NativeWind v5 preview deps + pin LightningCSS 1.30.1 via overrides
- Create `metro.config.js` with `withNativewind`, `postcss.config.mjs` with `@tailwindcss/postcss`
- Replace `src/global.css` with Tailwind v4 imports (keep web font vars)
- Create `src/tw/` directory with CSS-wrapped components for className support
- Create `src/app/settings.tsx` — 3rd route styled with NativeWind className
- Add 3rd tab trigger to both native (`app-tabs.tsx`) and web (`app-tabs.web.tsx`) tab bars
- Update `src/app/index.tsx` and `src/app/explore.tsx` headers to demonstrate className works across all 3 screens

### Out of Scope
- Migrating existing screen bodies from StyleSheet to className (separate change)
- Migrating the theme system (Colors, Fonts, Spacing) to Tailwind tokens
- Migrating web tab bar layout (branding, Docs link) — stays as-is

## Capabilities

### New Capabilities
- `nativewind-styling`: className-based component styling using Tailwind CSS v4 for all screens and components

### Modified Capabilities
None

## Approach

Incremental. Add NativeWind infra (deps, metro, postcss, global.css, wrapper components, type declarations), create a 3rd Settings tab with className as demo, add trigger to both tab bars. This is the lowest-risk path to "NativeWind works with 3 tabs" without restructuring routes or migrating working screens.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | 5 new deps + LightningCSS override |
| `metro.config.js` | New | `withNativewind` wrapper |
| `postcss.config.mjs` | New | `@tailwindcss/postcss` plugin |
| `src/global.css` | Replaced | Tailwind v4 imports + web font vars |
| `nativewind-env.d.ts` | New | Auto-generated types |
| `src/tw/` | New dir | CSS-wrapped component wrappers |
| `src/app/settings.tsx` | New | 3rd route with className |
| `src/app/index.tsx` | Modified | Header uses className |
| `src/app/explore.tsx` | Modified | Header uses className |
| `src/components/app-tabs.tsx` | Modified | 3rd NativeTabs trigger |
| `src/components/app-tabs.web.tsx` | Modified | 3rd TabTrigger |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LightningCSS desync from Expo | Med | Pin to 1.30.1 via overrides |
| react-native-css nightly API drift | Low | Pin exact commit hash |
| NativeWind v5 preview API changes | Low | Pin exact version |
| Bun overrides not working | Low | Verify after install; fallback to resolutions |

## Rollback Plan

Remove LightningCSS override + 5 nativewind deps from `package.json`, delete `metro.config.js`, `postcss.config.mjs`, `nativewind-env.d.ts`, `src/tw/`, `src/app/settings.tsx`, restore `src/global.css` from git, remove 3rd tab trigger from both `app-tabs.tsx` and `app-tabs.web.tsx`, revert `index.tsx`/`explore.tsx` headers, run `bun install`.

## Dependencies

- NativeWind v5 preview (`npm info nativewind versions --json` for latest)
- Expo SDK 56 bundled LightningCSS version (check for override pin)

## Success Criteria

- [ ] App builds and runs on iOS, Android, and web
- [ ] 3 tabs rendered on both native (NativeTabs) and web (expo-router/ui)
- [ ] Settings screen content uses className (verified visually)
- [ ] Home and Explore headers use className
- [ ] No build warnings related to LightningCSS or NativeWind
- [ ] `bun install` succeeds with LightningCSS override
