# Design: Cambiar fuente global a Caveat

## Technical Approach

Replace `Spline Sans` with Caveat as the global sans-serif font. Load Caveat at build time via `@expo-google-fonts/caveat` + `expo-font` config plugin, then change `--font-sans` in `src/global.css`. The font cascade flows through CSS variables → Tailwind `@theme` → component `className` — so no consumer code changes.

## Architecture Decisions

### Decision: Config plugin over `useFonts` hook

| Choice    | Config plugin (object syntax in `app.config.ts`)                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rejected  | `useFonts` hook in `_layout.tsx`                                                                                                                                                                                                                                    |
| Rationale | `useFonts` loads at runtime, causing a visible flash from system font → Caveat on every app launch. Config plugin embeds the `.ttf` files into the native binary at build time — zero flash, zero JS overhead. The font is available before the first React render. |

### Decision: `@expo-google-fonts` over manual `.ttf` downloads

| Choice    | `@expo-google-fonts/caveat` npm package                                                                                                                                                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rejected  | Download `Caveat-Regular.ttf`, `Caveat-Medium.ttf`, etc. into `assets/fonts/` and reference them manually                                                                                                                                                                                                   |
| Rationale | The `@expo-google-fonts/*` packages ship pre-optimized `.ttf` files with correct PostScript names and metadata. No manual download, no asset path typos, no version management. Works out of the box with `expo-font`'s config plugin. The package is already listed in `jest`'s `transformIgnorePatterns`. |

### Decision: 4 static weights over variable font

| Choice    | 4 static weights: Regular 400, Medium 500, SemiBold 600, Bold 700                                                                                                                                                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rejected  | Caveat Variable (single file with adjustable weight axis)                                                                                                                                                                                                                                                                                                                                 |
| Rationale | `@expo-google-fonts/caveat` already ships per-weight packages; variable fonts require an additional `@expo-google-fonts/caveat/variable` import path and the `expo-font` config plugin does not support variable font axes in the object syntax. Static weights map 1:1 to existing Tailwind classes (`font-normal`, `font-medium`, `font-semibold`, `font-bold`) with no behavioral gap. |

## CSS Variable Changes

### `:root` block

Replace `Spline Sans` with `Caveat` as the first value in `--font-sans`. The fallback chain (Inter, ui-sans-serif, etc.) stays intact:

```css
:root {
  --font-sans: Caveat, Inter, ui-sans-serif, system-ui, ...;
}
```

### `@media ios` override

Remove the iOS `--font-sans: system-ui` line so the `:root` value (Caveat) applies on iOS too. Keep the other overrides (`--font-serif: ui-serif`, `--font-rounded: ui-rounded`, `--font-mono: ui-monospace`) unchanged.

### `@theme` block

No change needed — `--font-sans: var(--font-sans)` already references the CSS variable and will pick up the new value automatically.

## Data Flow

```
package.json                      app.config.ts                     src/global.css
  @expo-google-fonts/caveat  ──►  expo-font plugin          ──►  --font-sans: Caveat, ...
  (provides .ttf files)            (embeds at prebuild)              │
                                                                    ▼
                                                          @theme { --font-sans: var(--font-sans) }
                                                                    │
                                                                    ▼
                                                          className="font-sans" / font-sans
                                                                    │
                                                                    ▼
                                                          TwText, ThemedText, TextInput, etc.
```

## File Changes

| File                                        | Action | Description                                                                               |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `package.json`                              | Modify | Add `@expo-google-fonts/caveat` dependency                                                |
| `app.config.ts`                             | Modify | Add `expo-font` plugin with 4-weight object syntax                                        |
| `src/global.css`                            | Modify | Replace `Spline Sans` with `Caveat` in `--font-sans`; remove iOS `--font-sans: system-ui` |
| `openspec/specs/nativewind-styling/spec.md` | Modify | Line 36: replace `Spline Sans` with `Caveat`                                              |

## Build Process

1. `bunx expo install @expo-google-fonts/caveat` — installs all 4 weight packages
2. Add `expo-font` plugin to `app.config.ts`:
   ```ts
   plugins: [
     ...existing,
     [
       'expo-font',
       {
         fonts: [
           '@expo-google-fonts/caveat/Caveat-Regular.ttf',
           '@expo-google-fonts/caveat/Caveat-Medium.ttf',
           '@expo-google-fonts/caveat/Caveat-SemiBold.ttf',
           '@expo-google-fonts/caveat/Caveat-Bold.ttf',
         ],
       },
     ],
   ],
   ```
3. Edit `src/global.css` — replace `Spline Sans` with `Caveat`, remove iOS `system-ui` override
4. Edit `openspec/specs/nativewind-styling/spec.md` line 36
5. `npx expo prebuild` — generates native projects with embedded fonts
6. Development build (`expo run:ios` / `expo run:android`) — Caveat is available at render start

## Interfaces / Contracts

No new interfaces. The config plugin contract with `expo-font` is the standard array-of-paths syntax. Font family name registered by the plugin is `Caveat` (the `@expo-google-fonts` package uses the PostScript name matching the family name).

## Testing Strategy

| Layer  | What to Test                  | Approach                                                                                              |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Lint   | TypeScript typecheck          | `make typecheck` — no new types, but verify `@expo-google-fonts/caveat` module resolution             |
| Build  | All platforms                 | `npx expo export --platform ios`, `--platform android`, `--platform web`                              |
| Visual | Font renders in all 4 weights | Manual: inspect rendered text elements for `font-normal`, `font-medium`, `font-semibold`, `font-bold` |

## Migration / Rollout

No migration required. This is a pure configuration change with no data or state.

## Open Questions

None.
