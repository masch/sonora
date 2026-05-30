# Sonora

Universal Expo app targeting iOS, Android, and Web.

**Stack:** Expo SDK 56 · React Native 0.85 · TypeScript 6.0 · expo-router · Tailwind CSS v4 · Jest

## Prerequisites

- [bun](https://bun.sh) — package manager
- `make` — build tool (comes with macOS/Linux)
- [gga](https://github.com/enzonotario/gga) (optional) — AI code review

```bash
# Install gga (if not installed)
bun install -g gga
```

## Setup

```bash
make install
```

This runs `bun install` and configures the git pre-commit hook.

> **Note:** Always use `make install` for setup. Running `bun install` directly will not configure the git hook.

## Development

```bash
make          # or make start — Expo dev server (platform picker)
make dev-web  # Expo dev server for web
make dev-ios  # Expo dev server for iOS
make dev-android # Expo dev server for Android
```

## Makefile targets

| Target                                | Description                                                   |
| ------------------------------------- | ------------------------------------------------------------- |
| `start`                               | Launch Expo dev server (default)                              |
| `dev-web` / `dev-ios` / `dev-android` | Launch Expo dev server for a specific platform                |
| `install`                             | Install dependencies + configure git hook                     |
| `format`                              | Format code with Prettier                                     |
| `test`                                | Run Jest test suite                                           |
| `lint`                                | Run ESLint via `expo lint`                                    |
| `typecheck`                           | TypeScript type checking (`tsc --noEmit`)                     |
| `validate`                            | Full development gate: format → test → lint → typecheck → gga |
| `check`                               | CI verification gate: format-check → test → lint → typecheck  |
| `gga`                                 | Run GGA code review on staged files                           |
| `gga-full`                            | Run GGA on all source files (stages, reviews, unstages)       |
| `doctor`                              | Run `expo-doctor` diagnostics                                 |
| `clean`                               | Remove build artifacts and `node_modules`                     |
| `reset`                               | Full reset: `clean` + `install`                               |
| `help`                                | Print all targets                                             |

### Validation pipeline

The `validate` target runs on every commit via a **git pre-commit hook** (`.githooks/pre-commit`). It runs:

1. **format** — Prettier formats all files
2. _Staged automatically_ — formatted files are added to the commit
3. **test** — Jest suite
4. **lint** — ESLint
5. **typecheck** — TypeScript compiler check
6. **gga** — AI code review on staged files

If any step fails, the commit is blocked. Use `git commit --no-verify` to bypass.

## Project structure

```
src/
├── app/          # expo-router file-based routes
├── components/   # Reusable UI components
├── constants/    # App constants
├── hooks/        # Custom React hooks
├── i18n/         # Internationalization
├── tw/           # Tailwind utilities
├── __tests__/    # Test suites
├── __mocks__/    # Test mocks
└── global.css    # Global styles
```

## Platform support

| Platform | Target                     |
| -------- | -------------------------- |
| iOS      | Native via Expo dev client |
| Android  | Native via Expo dev client |
| Web      | Static output via Expo     |
