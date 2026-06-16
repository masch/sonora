# Tasks: Fix Feedback Modal Input Focus Close

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | 20-40 lines    |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | ask-on-risk    |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Locales and Translations

- [x] 1.1 Add translation keys for discard confirmation dialog to `apps/mobile/src/i18n/locales/en.ts` under `feedback.form.confirm`.
- [x] 1.2 Add translation keys for discard confirmation dialog to `apps/mobile/src/i18n/locales/es.ts` under `feedback.form.confirm`.

## Phase 2: BottomModal Restructure

- [x] 2.1 Restructure `apps/mobile/src/components/ui/bottom-modal.tsx` to place `TwPressable` backdrop as an absolute sibling to `KeyboardAvoidingView` instead of wrapping it.

## Phase 3: FeedbackForm Core Implementation

- [x] 3.1 Modify `apps/mobile/src/components/feedback-form.tsx` to add `autoFocus` prop to `TwTextInput`.
- [x] 3.2 Add confirmation check using `Alert.alert` (with `window.confirm` fallback on Web) inside `handleDismiss` in `apps/mobile/src/components/feedback-form.tsx`.

## Phase 4: Testing & Verification

- [x] 4.1 Update `apps/mobile/src/__tests__/bottom-modal.test.tsx` to verify backdrop sibling clicks and content container click behavior.
- [x] 4.2 Update `apps/mobile/src/__tests__/feedback-form.test.tsx` to verify autofocus and Alert confirm dismissal behavior.
- [x] 4.3 Run `make test` to ensure all tests pass.
