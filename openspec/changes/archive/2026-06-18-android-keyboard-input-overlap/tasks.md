# Tasks: Android Keyboard Input Overlap Fix

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | ~20            |
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

- [x] 1.1 Update `apps/mobile/src/components/ui/bottom-modal.tsx` to move `KeyboardAvoidingView` to the root of the modal contents with `style={{ flex: 1 }}` and `behavior="padding"`.
- [x] 1.2 Update `apps/mobile/src/__tests__/bottom-modal.test.tsx` to verify the new root structure and `behavior="padding"` prop.

## Phase 2: Verification

- [x] 2.1 Run tests: `bun test src/__tests__/bottom-modal.test.tsx`.
- [x] 2.2 Run lint, formatting, and validation scripts: `make lint` or equivalent linter and formatter scripts.
