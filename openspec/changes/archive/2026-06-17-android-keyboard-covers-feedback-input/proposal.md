# Proposal: Android Keyboard Covers Feedback Input

## Intent

Resolve the Android-specific layout issue where the keyboard covers the feedback input field in the post-trip feedback modal, ensuring the user can see what they are typing.

## Scope

### In Scope

- Configure `BottomModal` to use `statusBarTranslucent={true}` on Android.
- Set `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` on `KeyboardAvoidingView` within `BottomModal`.

### Out of Scope

- Installing third-party keyboard handling libraries (e.g. `react-native-keyboard-controller`).

## Capabilities

### Modified Capabilities

- `bottom-modal`: Improved keyboard avoidance layout on Android.

## Approach

1. Update `BottomModal` in `src/components/ui/bottom-modal.tsx` to pass `statusBarTranslucent={true}` to the underlying React Native `<Modal>`.
2. Configure `<KeyboardAvoidingView>` inside `BottomModal` to use `behavior="height"` on Android.

## Affected Areas

| Area                                 | Impact   | Description                                                                         |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------- |
| `src/components/ui/bottom-modal.tsx` | Modified | Add `statusBarTranslucent` to Modal and adjust `behavior` for KeyboardAvoidingView. |

## Risks

| Risk                                           | Likelihood | Mitigation                                                                    |
| ---------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Layout shifts too high on some Android devices | Low        | Test on emulator/device using interactive tests and inspect visual alignment. |

## Rollback Plan

`git checkout main -- apps/mobile/src/components/ui/bottom-modal.tsx`

## Success Criteria

- [ ] Feedback modal remains fully visible and shifts above the keyboard when input is focused on Android.
- [ ] iOS behavior remains unaffected (retains `padding` behavior).
