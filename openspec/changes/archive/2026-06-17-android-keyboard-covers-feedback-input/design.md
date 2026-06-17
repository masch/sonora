# Design: Android Keyboard Covers Feedback Input

## Technical Approach

Modify the reusable `<BottomModal>` component in `apps/mobile/src/components/ui/bottom-modal.tsx` to correctly handle keyboard avoiding behavior on Android and enable translucency support in React Native's `<Modal>`.

## Architecture Decisions

### Decision: Update KeyboardAvoidingView and Modal Props

- **Choice**: Enable `statusBarTranslucent={true}` on `<Modal>` and set `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` on `<KeyboardAvoidingView>`.
- **Alternatives considered**:
  1. `behavior="padding"` on Android: Often requires `keyboardVerticalOffset` calculation which is error-prone when combined with different status bar behaviors.
  2. `behavior={undefined}` (Current): Relies entirely on Android's default window resizing which fails inside a `<Modal>`.
- **Rationale**: Setting `statusBarTranslucent={true}` ensures the Modal renders under the Android status bar, allowing correct offset calculation. Setting `behavior="height"` forces `KeyboardAvoidingView` to resize its height when the keyboard opens, pushing the text input up so it is not covered.

## File Changes

| File                                             | Action | Description                                                                                                                                    |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/ui/bottom-modal.tsx` | Modify | Update `<Modal>` props to include `statusBarTranslucent={true}`, and change `<KeyboardAvoidingView>` `behavior` prop to `'height'` on Android. |

## Testing Strategy

| Layer  | What to Test                        | Approach                                                                               |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------- |
| Unit   | Component renders and matches logic | Run existing Jest tests for `BottomModal` and `FeedbackForm` to ensure no regressions. |
| Manual | Keyboard avoidance on Android       | Verify behavior on Android emulator/device by typing in the feedback field.            |

## Migration / Rollout

No migration required.
