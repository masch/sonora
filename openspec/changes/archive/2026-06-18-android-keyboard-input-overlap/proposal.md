# Proposal: Android Keyboard Input Overlap Fix

## Intent

Ensure that when a user focuses the text input in the `BottomModal` (such as the feedback form) on Android, the keyboard does not overlap or obscure the input field. The modal content container should smoothly shift upward above the soft keyboard, maintaining full visibility and usability.

## Scope

### In Scope

- Restructure `BottomModal` layout to make `KeyboardAvoidingView` the root component of the Modal content on both iOS and Android.
- Configure `KeyboardAvoidingView` behavior to `"padding"` on iOS and `undefined` on Android.
- Update tests in `bottom-modal.test.tsx` to verify the correct behavior and attributes.

### Out of Scope

- Implementing scrollable/collapsible content sheets or changes to other modal/sheet components.

## Capabilities

### New Capabilities

None

### Modified Capabilities

- `BottomModal`: Keyboard avoidance will work on both iOS and Android instead of only iOS.

## Approach

1. **Move `KeyboardAvoidingView` to the root of the modal content**:
   - Change the layout hierarchy inside `<Modal>` to make `<KeyboardAvoidingView style={{ flex: 1 }}>` the outermost child wrapping the background backdrop and the contents.
   - Change `behavior` prop to `Platform.OS === 'ios' ? 'padding' : undefined`. On Android, `undefined` allows the system's native `adjustResize` window soft input mode to automatically resize the root view of the translucent modal.

## Affected Areas

| Area                                  | Impact   | Description                                                                         |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `src/components/ui/bottom-modal.tsx`  | Modified | Move `KeyboardAvoidingView` to the root of the modal content; update behavior prop. |
| `src/__tests__/bottom-modal.test.tsx` | Modified | Update test assertions for keyboard avoidance behavior and root structure.          |

## Risks

None anticipated.

## Rollback Plan

`git checkout main -- apps/mobile/src/components/ui/bottom-modal.tsx apps/mobile/src/__tests__/bottom-modal.test.tsx`

## Success Criteria

- [ ] When the modal is visible and the text input is focused, the content container shifts upward above the keyboard on Android.
- [ ] No regression in the existing bottom modal render or dismiss behaviors.
