## Exploration: Android Keyboard Input Overlap

### Current State

In `apps/mobile/src/components/ui/bottom-modal.tsx`, the `KeyboardAvoidingView` is nested inside `TwView className="flex-1 justify-end"` and only wraps the content container:

```tsx
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
```

On Android, inside a `<Modal>` with `statusBarTranslucent={true}`, using `behavior="height"` on a nested `KeyboardAvoidingView` without a `flex-1` structure causes the view to resize internally while remaining aligned to the bottom. Consequently, the keyboard overlaps the text input.

### Affected Areas

- [bottom-modal.tsx](file:///home/masch/dev/js/sonora/apps/mobile/src/components/ui/bottom-modal.tsx) — Needs restructuring to place `KeyboardAvoidingView` at the root with `style={{ flex: 1 }}`.
- [bottom-modal.test.tsx](file:///home/masch/dev/js/sonora/apps/mobile/src/__tests__/bottom-modal.test.tsx) — Needs test updates to match the new behavior prop/assertions.

### Approaches

1. **Root-level KeyboardAvoidingView with platform-specific behavior**
   - Place `KeyboardAvoidingView` directly inside `<Modal>` wrapping all components, with `style={{ flex: 1 }}`.
   - Use `behavior="padding"` on iOS and `behavior={undefined}` on Android.
   - Pros: Extremely robust, standard React Native pattern, relies on native `adjustResize` on Android.
   - Effort: Low

2. **Keep nested KeyboardAvoidingView and change behavior to `'padding'` on Android**
   - Pros: Less structural change.
   - Cons: Adding padding on a nested element might not sync properly with the translucent status bar layout boundary on all Android versions.
   - Effort: Low

### Recommendation

Use Approach 1: Move `KeyboardAvoidingView` to the root of the modal content, with `style={{ flex: 1 }}` and platform-specific behaviors.

### Risks

None anticipated.

### Ready for Proposal

Yes.
