# Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v56.0.0/> before writing any code.

# Sonora Project Conventions

## 1. Component Patterns

| Pattern               | Description                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ScreenWrapper`       | Outer container for every screen. Renders SafeAreaView + bottom tab inset.                                                           |
| `ScrollScreenWrapper` | Scrollable variant of ScreenWrapper for content that overflows.                                                                      |
| `ThemedText`          | Theme-aware `<Text>` replacement. Use `type` prop for variants (`small`, `code`, `link`, etc.) and `themeColor` for semantic colors. |
| `Icon`                | All icons — wraps `SymbolView` from `expo-symbols`. Never use raw vector-icons directly.                                             |
| `HintRow`             | Label + value row for hint/helper text below inputs.                                                                                 |
| `Collapsible`         | Expandable/collapsible section.                                                                                                      |
| `app-tabs`            | Tab navigator component used by the layout.                                                                                          |

## 2. Navigation

- **File-based routing** via Expo Router — routes live in `src/app/`.
- **Tab navigation** uses `<AppTabs />` from `src/components/app-tabs`.
- Route params are typed via expo-router's typed routes.

## 3. Style Conventions

- **Tailwind/NativeWind** via `className` prop on `Tw*` components (`TwView`, `TwText`, `TwPressable`, etc.).
- **CSS variables** for theme values (defined in `global.css` and accessed via Tailwind theme tokens).
- **Reusable style components** live in `src/tw/`.
- **No inline styles** — except for dynamic values that cannot be expressed in CSS (e.g., computed dimensions, dynamic colors).
- **No direct `<View>` or `<Text>`** — use `TwView` / `TwText` wrappers.

## 4. Animation Patterns

- **Native animations**: `expo-reanimated` via `animated-icon.tsx`.
- **Web animations**: `animated-icon.web.tsx` using CSS transitions.
- **No direct `react-native` `Animated` API** — use Reanimated only.

## 5. Testing Conventions

- **Test location**: `src/__tests__/` (colocated by convention, one test file per component/module).
- **Coverage scope**: render behavior, user interactions, accessibility labels.
- **Queries**: Prefer `screen.getByRole`, `screen.getByText`, `screen.getByTestId` from `@testing-library/react-native`.
- **No snapshot tests** for complex components — they break too often and provide false confidence.
- **Runner**: Jest with `jest-expo` preset.

## 6. Accessibility

- Every `Pressable` / `Touchable*` / interactive element **must** have an `accessibilityLabel`.
- Every `Image` **must** have an `alt` prop (use `alt=""` for decorative images).
- Every interactive component **must** have a `testID` with a descriptive kebab-case value (e.g., `testID="submit-button"`).

## 7. Loading States

- Use `LoadingView` for loading states (spinner + descriptive text).
- Show an **empty state** with descriptive text when data is absent.
- Use `ErrorBoundary` for error handling with retry capability.
- All async views **must** handle loading, error, and empty states.

## 8. i18n Rules

- Use `useTranslation` (or `useAppTranslation`) hook for all user-facing strings.
- **No hardcoded user-facing strings** — enforced by `i18next/no-literal-string` ESLint rule (error level).
- ESLint disable comments are permitted for technical strings (file paths, commands, etc.).

## 9. Git Workflow

- **No Commits on Main**: Never make commits directly on the `main` branch. Committing to `main` is strictly forbidden.
- **Early Branch Creation**: Always checkout a new feature/fix branch (`git checkout -b <branch-name>`) BEFORE making the first commit.
- **Branch naming**: `feat/description`, `fix/description`, `chore/description`, `docs/description`, `refactor/description` (kebab-case).
- **PR body**: must include summary of changes, reasoning (why), and test plan.
- **No direct pushes to `main`** — all changes go through PRs.
- **No `--no-verify`**: Bypassing commit validation hooks via `--no-verify` is strictly forbidden. There are no exceptions.
- **No `--amend`** on shared branches.
- **Post-Merge** ("mergeado"):
  1. Confirm PR and issue closed
  2. Switch to `main`
  3. `git pull origin main`
  4. `git branch -d branch-name`

## 10. Dependency Management

- **Bun Release Age**: The `minimumReleaseAge` setting in `bunfig.toml` (currently 345600s = 4 days) is a strict safety policy. Agents must NEVER comment out, bypass, or reduce this value. If a task requires a version newer than the limit, you must stop, report the conflict, and ask the user how to proceed.

## 11. GitHub CLI Sandbox Environment Overrides

- **GitHub CLI Commands**: The agent sandbox environments inject a dummy `GITHUB_TOKEN` (e.g., `github_pat_antigravitydummytoken`) which overrides the user's authentic local hosts credential configuration. When invoking `gh` commands, you MUST explicitly bypass this dummy token by unsetting `GITHUB_TOKEN` and `GH_TOKEN` environment variables using `env -u GITHUB_TOKEN -u GH_TOKEN gh <command>` to allow the CLI to use the user's local keychain/helper authentication.

## 12. Payment and Checkout Conventions

- **Currency Representation**: Store all monetary values as integers in minor units (cents/centavos) in the database and API payloads to prevent floating-point precision errors (e.g., store `$15.000` as `1500000`).
- **Decimal Format Display**: Use the `formatPrice` helper to format values. Whole numbers of pesos should default to hiding decimals (e.g. `15.000`), while fraction amounts must display them (e.g. `150,50`).
- **Routing Prefixes**: Sub-routers mounted on Hono backend groups (like `/payments`) must have their route paths explicitly prefixed with that namespace in client-side calls (e.g., prefix `/experiences/:id/purchased` as `/payments/experiences/:id/purchased`).
- **WebBrowser Checkout Polling**: When initiating checkouts on web via `openAuthSessionAsync`, the parent container must begin status polling in parallel immediately, as the popup closure event might not resolve the promise instantly.
- **Active Sync Fallback**: Always include `?sync=true` in client polling status requests to force real-time gateway checks in non-production environments where sandbox webhooks may experience latency or failure.
