# Tasks: Migrate StyleSheet → NativeWind className

**Change**: `sonora-issue4-migrate-stylesheet-to-nativewind`

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~270 (additions + deletions) |
| Largest single phase | Phase 2 (~80 lines) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

**Rationale**: ~270 changed lines across 9 modified + 1 deleted file is well within the 400-line review budget. Phases are sequential (no file conflicts), so a single PR with clean commit-per-phase works. The phased structure is retained for implementation order, not PR splitting.

### Spacing Translation Reference

| Custom | Value (px) | Tailwind class |
|--------|-----------|----------------|
| `Spacing.half` | 2 | `*-0.5` |
| `Spacing.one` | 4 | `*-1` |
| `Spacing.two` | 8 | `*-2` |
| `Spacing.three` | 16 | `*-4` |
| `Spacing.four` | 24 | `*-6` |
| `Spacing.five` | 32 | `*-8` |
| `Spacing.six` | 64 | `*-16` |

### Border Radius Mapping

| Spacing | px | Tailwind |
|---------|----|----------|
| `half` | 2 | `rounded-sm` |
| `one` | 4 | `rounded` |
| `two` | 8 | `rounded-lg` |
| `three` | 16 | `rounded-2xl` |
| `four` | 24 | `rounded-[24px]` |
| `five` | 32 | `rounded-[32px]` |

---

## Phase 0: Color Tokens — Foundation ✅

**Scope**: Register 5 color tokens in CSS `@theme` using `light-dark()`, remove vestigial `@variant dark` block.

**Files**: `src/global.css`

**Changes**:
- [x] Add inside existing `@theme { }`: `--color-text`, `--color-background`, `--color-backgroundElement`, `--color-backgroundSelected`, `--color-textSecondary` — each with `light-dark(<light>, <dark>)` matching hex values from `src/constants/theme.ts`
- [x] Delete `@variant dark { :root { --color-bg: ...; --color-text: ...; } }` block (lines 42-47)

**Estimated lines**: ~12 changed

**Dependencies**: None (base)

**Verification**:
- [x] `make typecheck` — no errors
- [x] `bun run test` — all pass
- [x] Confirm `bg-background`, `text-text`, `text-textSecondary` etc. resolve as valid NativeWind class names
- Manual: toggle dark mode in web devtools, verify `light-dark()` resolves correctly

---

## Phase 1: Leaf Components ✅

**Scope**: Migrate 3 leaf components with no dynamic style values.

**Files**: `src/components/hint-row.tsx`, `src/components/web-badge.tsx`, `src/components/ui/collapsible.tsx`

### 1.1 hint-row.tsx ✅
- [x] **Remove imports**: `View`, `StyleSheet` (RN); `ThemedView`; `Spacing`
- [x] **Add import**: `TwView` from `@/tw`
- [x] **JSX changes**:
  - `<View style={styles.stepRow}>` → `<TwView className="flex-row justify-between">`
  - `<ThemedView type="backgroundSelected" style={styles.codeSnippet}>` → `<TwView className="bg-backgroundSelected rounded-lg py-0.5 px-2">`
- [x] **Delete**: `const styles = StyleSheet.create({...})` block (5 lines)

### 1.2 web-badge.tsx ✅
- [x] **Remove imports**: `StyleSheet`; `ThemedView`; `Spacing`
- [x] **Add import**: `TwView` from `@/tw`
- [x] **Keep**: `useColorScheme` (badge image source logic)
- [x] **JSX changes**:
  - `<ThemedView style={styles.container}>` → `<TwView className="items-center gap-2 p-8">`
  - `style={styles.versionText}` → `style={{ textAlign: 'center' }}` (inlined)
  - `style={styles.badgeImage}` → `style={{ width: 123, aspectRatio: 123/24 }}` (inlined)
- [x] **Delete**: `StyleSheet.create` block (9 lines)

### 1.3 collapsible.tsx ✅
- [x] **Remove imports**: `StyleSheet`; `ThemedView`; `Spacing`
- [x] **Add imports**: `TwView`, `TwPressable` from `@/tw`; `TwAnimatedView` from `@/tw/animated`
- [x] **Keep**: `useTheme` (SymbolView tintColor); `FadeIn` from reanimated
- [x] **JSX changes**:
  - `<ThemedView>` → `<TwView>` (outer wrapper)
  - `<Pressable style={({pressed}) => [styles.heading, pressed && styles.pressedHeading]}>` → `<TwPressable className="flex-row items-center gap-2 active:opacity-70">`
  - `<ThemedView type="backgroundElement" style={styles.button}>` → `<TwView className="bg-backgroundElement w-6 h-6 rounded-xl justify-center items-center">`
  - `<Animated.View entering={FadeIn.duration(200)}>` → `<TwAnimatedView entering={FadeIn.duration(200)}>`
  - `<ThemedView type="backgroundElement" style={styles.content}>` → `<TwView className="bg-backgroundElement mt-4 rounded-2xl ml-6 p-6">`
- [x] **Delete**: `StyleSheet.create` block (16 lines)

**Estimated lines**: ~65 changed

**Dependencies**: Phase 0 (color tokens must exist)

**Verification**:
- [x] `make typecheck` — no errors
- [x] `bun run test` — all pass
- [x] `grep -c 'StyleSheet.create'` on each file → 0
- Manual: verify collapsible animation still plays, chevron rotates, hint-row renders step layout correctly

---

## Phase 2: Pages ✅

**Scope**: Migrate the two screen pages. SafeAreaView `contentInset`/`contentContainerStyle` dynamic props stay as JS.

**Files**: `src/app/index.tsx`, `src/app/explore.tsx`

### 2.1 index.tsx ✅
- [x] **Remove imports**: `StyleSheet`; `ThemedView`
- [x] **Add import**: `TwView` from `@/tw`
- [x] **Keep**: `BottomTabInset`, `Spacing`, `MaxContentWidth` (safeArea dynamic paddingBottom)
- [x] **JSX changes**:
  - `<ThemedView style={styles.container}>` → `<TwView className="flex-1 justify-center flex-row">`
  - `<SafeAreaView style={styles.safeArea}>` → inline `style` with dynamic `paddingBottom: BottomTabInset + Spacing.three`
  - `<ThemedView style={styles.heroSection}>` → `<TwView className="items-center justify-center flex-1 px-6 gap-6">`
  - `<ThemedText type="code" style={styles.code}>` → `<ThemedText type="code" className="uppercase">`
  - `<ThemedView type="backgroundElement" style={styles.stepContainer}>` → `<TwView className="bg-backgroundElement gap-4 self-stretch px-4 py-6 rounded-[24px]">`
- [x] **Delete**: `StyleSheet.create` block (22 lines)

### 2.2 explore.tsx ✅
- [x] **Remove imports**: `StyleSheet`; `ThemedView`
- [x] **Add imports**: `TwView`, `TwScrollView`, `TwPressable` from `@/tw`
- [x] **Keep**: `useTheme` (SymbolView tintColor); `useSafeAreaInsets`; `Spacing`, `BottomTabInset` (dynamic insets stay as JS values)
- [x] **JSX changes**:
  - `<ScrollView style={[styles.scrollView, { backgroundColor }]} contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>` → `<TwScrollView className="flex-1 bg-background" contentContainerClassName="flex-row justify-center" contentContainerStyle={contentPlatformStyle}>`
  - Keep `contentInset={insets}` unchanged
  - `<ThemedView style={styles.container}>` → `<TwView className="max-w-[800px] flex-grow">`
  - `<ThemedView style={styles.titleContainer}>` → `<TwView className="gap-4 items-center px-6 py-16">`
  - `<ThemedText style={styles.centerText}>` → `<ThemedText className="text-center">`
  - `<Pressable style={({pressed}) => pressed && styles.pressed}>` → `<TwPressable className="active:opacity-70">`
  - `<ThemedView type="backgroundElement" style={styles.linkButton}>` → `<TwView className="bg-backgroundElement flex-row px-6 py-2 rounded-[32px] justify-center gap-1 items-center">`
  - `<ThemedView style={styles.sectionsWrapper}>` → `<TwView className="gap-8 px-6 pt-4">`
  - `<ThemedView type="backgroundElement" style={styles.collapsibleContent}>` → `<TwView className="bg-backgroundElement items-center">`
  - `style={styles.imageTutorial}` → `style={{ width: '100%', aspectRatio: 296/171, borderRadius: 16, marginTop: 8 }}` (inlined)
  - `style={styles.imageReact}` → `style={{ width: 100, height: 100, alignSelf: 'center' }}` (inlined)
- [x] **Delete**: `StyleSheet.create` block (40 lines)

**Estimated lines**: ~80 changed

**Dependencies**: Phase 1 (leaf components are rendered inside pages), Phase 3 (ThemedText `className` prop may be used before it's refactored — use `style` as fallback if not yet available)

**Verification**:
- [x] `make typecheck` — no errors
- [x] `bun run test` — all pass
- Manual: verify explore.tsx scroll, contentInset, collapsible animations, Pressable `active:` opacity all work
- Manual: verify index.tsx layout matches before in light + dark mode on web and iOS simulator

---

## Phase 3: Core Wrappers ✅

**Scope**: Rewrite `ThemedText` to use internal className map. Delete `ThemedView` entirely.

**Files**: `src/components/themed-text.tsx`, `src/components/themed-view.tsx`

### 3.1 themed-text.tsx ✅
- [x] **Remove imports**: `StyleSheet`, `Text` (RN); `Fonts`; `useTheme`
- [x] **Add imports**: `TwText` from `@/tw`
- [x] **Add** `className?: string` to `ThemedTextProps`
- [x] **Add** `typeClassMap` constant mapping each `type` to Tailwind classes:
  - `default`: `text-base font-medium leading-6`
  - `title`: `text-5xl font-semibold leading-[52px]`
  - `small`: `text-sm font-medium leading-5`
  - `smallBold`: `text-sm font-bold leading-5`
  - `subtitle`: `text-[32px] font-semibold leading-[44px]`
  - `link`: `text-sm leading-[30px]`
  - `linkPrimary`: `text-sm leading-[30px] text-[#3c87f7]`
  - `code`: `text-xs font-mono` + `Platform.select({ android: 'font-bold', default: 'font-medium' })`
- [x] **Add** `colorClassMap`: `text`→`text-text`, `textSecondary`→`text-textSecondary`, `background`→`text-background`, `backgroundElement`→`text-backgroundElement`, `backgroundSelected`→`text-backgroundSelected`
- [x] **Rewrite render**: `<TwText className={combined} style={style} {...rest} />`
- [x] **Delete**: `StyleSheet.create` block (27 lines)

### 3.2 themed-view.tsx ✅
- [x] **DELETE** file entirely (16 lines)
- [x] All callers already replaced in Phases 1, 2, 4 with `TwView` + `bg-*` class
- [x] Example/ directory imports fixed to use local relative paths

**Estimated lines**: ~55 changed

**Dependencies**: Phase 0 (color tokens), independent of Phase 1/2/4 (but provides className prop that they reference)

**Verification**:
- [x] `make typecheck` — no errors (verify `ThemedText` props backward-compat)
- [x] `bun run test` — all pass
- [x] Confirm `src/components/themed-view.tsx` is deleted
- Manual: verify each `ThemedText type` renders at correct font size, weight, and line height across platforms

---

## Phase 4: Web Tabs ✅

**Scope**: Migrate app-tabs.web.tsx layout styles. `Colors` import stays for `SymbolView` tintColor.

**Files**: `src/components/app-tabs.web.tsx`

**Changes**:
- [x] **Remove imports**: `StyleSheet`, `View`, `ThemedView`, `Spacing`
- [x] **Add import**: `TwView`, `TwPressable` from `@/tw`
- [x] **Keep**: `Colors` (SymbolView tintColor)
- [x] **JSX changes**:
  - `<View {...props} style={styles.tabListContainer}>` → `<TwView className="absolute w-full p-4 justify-center items-center flex-row">`
  - `<ThemedView type="backgroundElement" style={styles.innerContainer}>` → `<TwView className="bg-backgroundElement py-2 px-8 rounded-[32px] flex-row items-center flex-grow gap-2 max-w-[800px]">`
  - `<ThemedText type="smallBold" style={styles.brandText}>` → `<ThemedText type="smallBold" className="mr-auto">`
  - `<ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'} style={styles.tabButtonView}>` → `<TwView className={`${isFocused ? 'bg-backgroundSelected' : 'bg-backgroundElement'} py-1 px-4 rounded-2xl`}>`
  - `<Pressable style={styles.externalPressable}>` → `<TwPressable className="flex-row justify-center items-center gap-1 ml-4">`
  - `<Pressable style={({pressed}) => pressed && styles.pressed}>` → `className="active:opacity-70"` (on TwPressable)
- [x] **Delete**: `StyleSheet.create` block (20 lines)

**Estimated lines**: ~50 changed

**Dependencies**: Phase 0 (color tokens), Phase 3 (ThemedText className prop for `brandText`)

**Verification**:
- [x] `make typecheck` — no errors
- [x] `bun run test` — all pass
- Manual: web-only check on `/` and `/explore` routes, verify tab bar layout, focus states, dark mode

---

## Phase 5: Cleanup ✅

**Scope**: Prune unused exports from `theme.ts`. Run audit to confirm zero `StyleSheet.create` in migrated files.

**Files**: `src/constants/theme.ts`

**Changes**:
- [x] `Colors` → **keep** (consumed by app-tabs.web.tsx SymbolView tintColor, app-tabs.tsx native props)
- [x] `Spacing` → **keep** (consumed by index.tsx safeArea padding, explore.tsx dynamic insets)
- [x] `Fonts` → **keep** (consumed by animated-icon.tsx/web — out of scope)
- [x] `BottomTabInset` → **keep** (consumed by index.tsx, explore.tsx)
- [x] `MaxContentWidth` → **keep** (consumed by index.tsx)
- [x] `ThemeColor` type → **keep** (consumed by themed-text.tsx)

**No exports removed** — all are still consumed by in-scope or out-of-scope files. Cleanup is a verification pass.

**Audit commands**:
- [x] `grep -rn 'StyleSheet.create' src/ --include='*.tsx'` — confirm only `animated-icon.tsx`, `animated-icon.web.tsx` remain
- [x] `grep -rn 'Spacing' src/ --include='*.tsx'` — confirm no refs remain in migrated files (only dynamic JS values)
- [x] `make typecheck` — zero errors
- [x] `bun run test` — all 20 pass

**Estimated lines**: ~5 changed (no net removal)

**Dependencies**: All phases 0-4 complete

**Verification**:
- [x] Run full test suite: `typecheck && bun run test` — ✅
- Visual: web + iOS simulator, light + dark mode toggle
- [x] Confirm `grep -rn 'StyleSheet.create' src/components/ src/app/` returns 0 for migrated files

---

## Implementation Order

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
              │            │            │
              └──── Phase 3 provides className prop for ThemedText ───┘
                         (backward-compat: style prop fallback works without it)
```

Phase 3 (ThemedText refactor) adds `className` prop backward-compatibly. Phases 1, 2, 4 reference it but can use `style={{}}` if applied before Phase 3. Recommended order: Phase 0 → 1 → 2 → 3 → 4 → 5 for cleanest diffs.

---

## Verification Checklist (Final)

- [x] `make typecheck` — zero type errors ✅
- [x] `bun run test` — all 20 tests pass ✅
- [x] `grep -rn 'StyleSheet.create' src/components/ src/app/` — zero hits in migrated files ✅
- [ ] Visual: home screen renders identically (light + dark mode, web + iOS) — manual
- [ ] Visual: explore page scrolls, collapsibles animate, contentInset works — manual
- [ ] Visual: web tab bar renders with correct focus states — manual
- [ ] Visual: dark mode via devtools/browser — colors match `Colors.dark` values — manual
- [x] No runtime `useTheme()` calls for styling (only SymbolView tintColor) ✅
