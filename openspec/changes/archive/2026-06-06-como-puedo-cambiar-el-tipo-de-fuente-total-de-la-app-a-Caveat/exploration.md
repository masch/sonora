## Exploration: Cambiar fuente global a Caveat

### Current State

The Sonora app uses a **CSS-variable-driven font system** via Tailwind v4 / NativeWind v5. All fonts are controlled through CSS variables in `src/global.css`:

- **`--font-sans`**: The primary font family (default for all text). Currently set to `Spline Sans, Inter, ui-sans-serif, system-ui, ...` with platform-specific overrides (`system-ui` on iOS, `normal` on Android).
- **`--font-mono`**: Monospace font, registered as `font-mono` Tailwind utility.
- **`--font-serif`**, **`--font-rounded`**: Additional families, registered as utilities.

The `@theme {}` block in `global.css` registers these CSS variables as Tailwind design tokens:

```css
@theme {
  --font-sans: var(--font-sans);
  --font-serif: var(--font-serif);
  ...
}
```

All text rendering uses Tailwind utility classes via `<TwText>` or `<ThemedText>` components. **No `fontFamily` inline styles exist** in the codebase. The `<ThemedText>` component applies Tailwind classes like `font-medium`, `font-semibold`, `font-bold` etc., which set `font-weight` independently of `font-family`.

**No custom fonts are currently loaded.** The `expo-font` package (v56.0.5) is already in `package.json` dependencies, but there is no `useFonts`, `loadAsync`, or config plugin usage. There is no `assets/fonts/` directory.

### Affected Areas

- `src/app/_layout.tsx` — Root layout; entry point where fonts would be loaded (via `useFonts` or other mechanism)
- `src/global.css` — CSS variables `--font-sans` and its platform overrides must change to include Caveat
- `app.config.ts` — If using the `expo-font` config plugin (recommended for production), needs the plugin entry added
- `package.json` — New dependency needed: `@expo-google-fonts/caveat` (if using the package approach)
- `src/components/themed-text.tsx` — Potentially affected if we change the default font family at the component level (but CSS approach makes this unnecessary)
- `src/app/(tabs)/index.tsx`, `src/components/audio-media-controls.tsx`, `src/components/gps-precision-badge.tsx` — All components using `TwText` or `ThemedText` will inherit the new font globally

### Approaches

1. **@expo-google-fonts/caveat with config plugin (recommended)** — Install the `@expo-google-fonts/caveat` package, register font files via `expo-font` config plugin in `app.config.ts`, update CSS variables.
   - **Pros**: Works without manual font downloading; fonts embedded at build time (no async loading); all 4 weights available; zero runtime font-loading code; the `expo-font` plugin supports the `fonts` + `android` object syntax to register all variants under one `fontFamily` name
   - **Cons**: Requires a development build (not Expo Go); needs to reference font files inside `node_modules/` in the config plugin
   - **Effort**: Low

2. **Download Caveat .ttf files + expo-font config plugin** — Manually download Caveat font files into `assets/fonts/` and register them via the config plugin.
   - **Pros**: No npm dependency on Google Fonts packages; full control over which files are bundled; fonts available at build time (no async)
   - **Cons**: Manual download & maintenance; needs development build; need to manage the 4 weight files
   - **Effort**: Medium

3. **@expo-google-fonts/caveat with `useFonts` hook** — Install the package, load fonts asynchronously in `_layout.tsx` using the `useFonts` hook.
   - **Pros**: Works in Expo Go; simplest implementation; no config plugin needed
   - **Cons**: Async loading causes a flash/flicker or requires hiding splash screen; more code in layout; less performant than build-time embedding
   - **Effort**: Low

### Recommendation

**Approach 1** is the best fit for this project. Here's why:

1. The project already has `expo-font` in dependencies — nothing new to install there
2. The project uses `app.config.ts` (TypeScript), making it easy to add the config plugin
3. Build-time font embedding matches the project's production-ready approach (they're not using Expo Go)
4. The `@expo-google-fonts/caveat` package provides 4 weights (Regular 400, Medium 500, SemiBold 600, Bold 700) that map perfectly to the existing Tailwind font-weight classes used across the app (`font-medium`, `font-semibold`, `font-bold`)
5. Only the CSS variables in `global.css` need updating to make the change apply globally — no component code changes needed

The implementation plan:

1. **Install**: `bunx expo install @expo-google-fonts/caveat`
2. **Config plugin** in `app.config.ts`: Add `expo-font` plugin pointing to the font files inside `node_modules/@expo-google-fonts/caveat/` (use object syntax to register all 4 weights under `fontFamily: "Caveat"`)
3. **CSS update** in `global.css`: Update `--font-sans` to include `"Caveat"` as the first entry in the font-family stack; update iOS/Android platform overrides similarly
4. **Rebuild**: Run `npx expo prebuild` and create a new development build

### Risks

- **Font family name discovery**: When using the config plugin with array-of-paths syntax, Android uses the filename as family name, iOS reads from font metadata. The object syntax (with explicit `fontFamily`) is preferred to guarantee cross-platform consistency. The font family name should be verified before finalizing.
- **Variable font not supported**: Caveat has a variable font version on Google Fonts, but Expo docs warn variable fonts don't have full platform support. The `@expo-google-fonts/caveat` package uses static .ttf files (4 weights), which avoids this issue.
- **`font-code` class**: There's one reference to `font-code` in the codebase (in `audio-media-controls.tsx`), which may be a non-existent Tailwind utility. This is unrelated to this change but worth noting.
- **Platform-specific overrides**: The `@media ios { :root { --font-sans: system-ui; } }` block currently overrides the custom font on iOS. This must be updated to use Caveat instead (or include it as a fallback).

### Ready for Proposal

Yes
