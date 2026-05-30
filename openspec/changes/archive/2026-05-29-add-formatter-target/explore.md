# Explore: Add Formatter Target

We want to add a formatter to the project and a corresponding target in the `Makefile`.

## Formatter Options

1. **Prettier** (Recommended)
   - **Pros**: Industry standard, zero-config formatting for JS, TS, JSX, TSX, JSON, CSS, Markdown. It's already cached/available locally (resolved version `3.8.3`).
   - **Cons**: Needs to be added to `package.json` as a devDependency to lock the version.
   - **Implementation**:
     - Install `prettier`: `bun add -d prettier`
     - Create `.prettierrc` (e.g., standard rules: semi: true, singleQuote: true, trailingComma: all, tabWidth: 2).
     - Create `.prettierignore` to skip `node_modules`, `.expo`, `dist`, `coverage`, etc.
     - Add `"format": "prettier --write ."` to `package.json` scripts.
     - Add `format` target to `Makefile`.
     - Update `openspec/config.yaml` with `formatter: make format`.

2. **ESLint Formatting**
   - **Pros**: Uses existing linter configuration.
   - **Cons**: ESLint 9 Flat config formatting rules are mostly deprecated in favor of separate formatters (like Prettier). Running `--fix` is for linting rules, not comprehensive formatting.

3. **Biome / dprint**
   - **Pros**: Extremely fast.
   - **Cons**: Non-standard in standard Expo setups, extra configuration overhead.

## Recommendation

We will proceed with **Prettier**. It's the most robust and standard choice for an Expo SDK 56 TypeScript application.

## Affected Files

- [package.json](file:///home/masch/dev/js/sonora/package.json)
- [Makefile](file:///home/masch/dev/js/sonora/Makefile)
- [openspec/config.yaml](file:///home/masch/dev/js/sonora/openspec/config.yaml)
- [NEW] [.prettierrc](file:///home/masch/dev/js/sonora/.prettierrc)
- [NEW] [.prettierignore](file:///home/masch/dev/js/sonora/.prettierignore)
