## Exploration: Android Keyboard Covers Feedback Input

### Current State

On Android, when the post-trip feedback modal (`FeedbackForm` using `BottomModal`) is shown and the text input receives focus, the keyboard slides up and completely covers the input area. The user cannot see what they are typing.

This happens because in `BottomModal.tsx`:

1. `<Modal>` is rendered without the `statusBarTranslucent` prop. On Android, translucent headers/statusbars can cause offsets in `KeyboardAvoidingView`.
2. The `<KeyboardAvoidingView>` uses `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. On Android, `behavior` is `undefined`, meaning the component does not attempt to avoid the keyboard, relying instead on Android's default window soft input adjustment. However, inside a React Native `<Modal>`, Android's default resize adjustment often fails to resize the modal's contents correctly.

### Affected Areas

- [bottom-modal.tsx](file:///home/masch/dev/js/sonora/apps/mobile/src/components/ui/bottom-modal.tsx) — Contains the `Modal` and `KeyboardAvoidingView` layout wrapper.

### Approaches

1. **Adjust KeyboardAvoidingView Behavior & Add Modal Translucency (Recommended)**
   - Set `statusBarTranslucent={true}` on the `<Modal>`.
   - Change `KeyboardAvoidingView` behavior to use `'height'` (or `'padding'`) on Android: `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.
   - **Pros**: Pure React Native solution, requires no new dependencies, highly reliable for modal keyboard avoidance on Android.
   - **Cons**: Needs visual verification on Android device or emulator.
   - **Effort**: Low.

2. **Add react-native-keyboard-controller**
   - Install and integrate a dedicated library for keyboard avoidance.
   - **Pros**: Super smooth animations.
   - **Cons**: Adds a native library dependency, increasing bundle size and build complexity. Expo minimum release age rules must be checked.
   - **Effort**: High.

### Recommendation

Use Approach 1. It is a straightforward, standard solution using existing React Native APIs without introducing external dependencies.

### Risks

- Adjusting behavior to `'height'` or `'padding'` might require adjusting offset parameters if the modal container shifts too high or not enough. This can be verified via testing/manual review.

### Ready for Proposal

Yes.
