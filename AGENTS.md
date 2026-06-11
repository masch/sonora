# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

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

- **Branch naming**: `feat/description`, `fix/description`, `chore/description`, `docs/description`, `refactor/description` (kebab-case).
- **PR body**: must include summary of changes, reasoning (why), and test plan.
- **No direct pushes to `main`** — all changes go through PRs.
- **No `--no-verify`** — except for emergencies (document in commit message).
- **No `--amend`** on shared branches.
- **Post-Merge** ("mergeado"):
  1. Confirm PR and issue closed
  2. Switch to `main`
  3. `git pull origin main`
  4. `git branch -d branch-name`

## 10. Dependency Management

- **Bun Release Age**: The `minimumReleaseAge` setting in `bunfig.toml` (which requires packages to be at least 10 days old) is a strict safety policy. Agents must NEVER comment out, bypass, or reduce this value. If a task requires a version newer than the limit, you must stop, report the conflict, and ask the user how to proceed.
