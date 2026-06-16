## Exploration: fix-feedback-modal-input-focus

### Current State

The `BottomModal` component wraps the content (including inputs) inside a `TwPressable` backdrop with `onPress={onDismiss}`. Because of the view nesting, tapping/focusing on a `TextInput` inside the modal children bubbles up or triggers the backdrop `Pressable` responder, causing the modal to dismiss automatically when clicked.

### Affected Areas

- `apps/mobile/src/components/ui/bottom-modal.tsx` — Wrap the backdrop `TwPressable` as an absolute sibling instead of wrapping the content container to prevent press event bubbling.

### Approaches

1. **Sibling Backdrop (Recommended)** — Structure the backdrop `TwPressable` as an absolute sibling to the content container inside the `<Modal>`:
   - Pros: Completely prevents event propagation from the content to the backdrop because the content is not a child of the pressable. Standard React Native/Expo design pattern.
   - Cons: None.
   - Effort: Low

2. **Stop Propagation on Press** — Try to block the event propagation inside children using nested touch handlers or overlay overrides:
   - Pros: Keeps the nesting structure.
   - Cons: Fragile and complex in React Native due to responder lifecycle inconsistencies between platforms.
   - Effort: Medium

### Recommendation

We recommend **Approach 1 (Sibling Backdrop)** because it is the standard, most robust React Native pattern for overlay backdrops and completely isolates tap events.

### Risks

- None.

### Ready for Proposal

Yes
