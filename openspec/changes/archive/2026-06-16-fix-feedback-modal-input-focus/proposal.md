# Proposal: Fix Feedback Modal Input Focus Close

## Intent

Resolve the issue where the feedback modal closes automatically when the user taps or focuses on the text input. We also want to improve the user experience by auto-focusing the text input when the modal opens and prompting the user with a confirmation dialog if they attempt to dismiss the modal after they have typed some text.

## Scope

### In Scope

- Prevent the modal from closing when the user clicks or focuses the text input.
- Automatically focus the text input when the modal is opened.
- Prompt the user with a confirmation dialog before dismissing if the input contains unsaved text.
- Maintain native accessibility properties of the modal elements.

### Out of Scope

- Changing the backend feedback collection APIs.
- Redesigning the styling of the feedback modal.

## Capabilities

### New Capabilities

None

### Modified Capabilities

- `feedback`: Added text confirmation dialog on dismiss and auto-focus requirements to the feedback collection form modal.

## Approach

Structure the backdrop `TwPressable` as an absolute sibling (rather than parent) to the modal content container inside `BottomModal`. This completely prevents touch events on the inputs from bubbling up to the backdrop's click handler.

Inside `FeedbackForm`:

1. Add `autoFocus` prop to the `TextInput` to automatically prompt keyboard on open.
2. Intercept the close action (backdrop tap or close button) to check if the user has typed text. If they have, show an alert dialog (`Alert.alert`) requesting confirmation before discarding the feedback.

## Affected Areas

| Area                                             | Impact   | Description                                                                                     |
| ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/ui/bottom-modal.tsx` | Modified | Structure backdrop pressable as a sibling instead of parent to prevent event bubbling.          |
| `apps/mobile/src/components/feedback-form.tsx`   | Modified | Add autofocus to TextInput, intercept dismiss action to prompt confirmation if text is present. |

## Risks

| Risk                          | Likelihood | Mitigation                                                  |
| ----------------------------- | ---------- | ----------------------------------------------------------- |
| Dialog breaks automatic tests | Low        | Ensure test mock alerts or checks if the alert is rendered. |

## Rollback Plan

Revert the modified files to their previous git commits:

```bash
git checkout HEAD -- apps/mobile/src/components/ui/bottom-modal.tsx apps/mobile/src/components/feedback-form.tsx
```

## Dependencies

None

## Success Criteria

- [ ] Tapping or focusing the text input in the feedback modal does not close the modal.
- [ ] The keyboard automatically opens, and focus is placed on the text input when the modal opens.
- [ ] If the input contains text, tapping the backdrop prompts a confirmation dialog. Tapping "Keep Editing" preserves the modal, while "Discard" closes it.
- [ ] All unit/integration tests for the modal pass.
