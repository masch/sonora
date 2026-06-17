# Tasks: Android Keyboard Covers Feedback Input

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | ~10            |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | ask-on-risk    |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Core Implementation

- [x] 1.1 Update `apps/mobile/src/components/ui/bottom-modal.tsx` to set `statusBarTranslucent={true}` on `<Modal>` and `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` on `<KeyboardAvoidingView>`.

## Phase 2: Verification

- [x] 2.1 Run tests to ensure no regression in `BottomModal` or `FeedbackForm` behavior: `bun test src/__tests__/bottom-modal.test.tsx`.
- [x] 2.2 Run static analysis check: `make lint` or equivalent linter and formatter scripts in `apps/mobile`.
