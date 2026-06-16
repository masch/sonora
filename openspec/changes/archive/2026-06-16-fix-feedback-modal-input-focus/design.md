# Design: Fix Feedback Modal Input Focus Close

## Technical Approach

We will isolate the overlay tap-to-dismiss behavior in `BottomModal` from its children by restructuring the JSX hierarchy. Instead of wrapping the contents in the dismissable `TwPressable` backdrop, we will place the backdrop as an absolute-positioned sibling at the same level as the `KeyboardAvoidingView` containing the modal content.

In `FeedbackForm`, we will add the `autoFocus` prop to `TwTextInput` and implement a confirmation check in `handleDismiss` that intercepts dismiss requests (backdrop tap or close button) when there is unsaved text inside the input.

## Architecture Decisions

### Decision: Sibling Backdrop vs. Responder StopPropagation

| Option                               | Tradeoff                                                                                                                                   | Decision   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Nested Container (Propagation Stop)  | Relies on React Native `onStartShouldSetResponder` to block bubbling. Known to fail/have inconsistencies across platform touch responders. | Rejected   |
| Sibling Backdrop (Absolute Position) | Separates the touch target physically from the content hierarchy. Simple CSS absolute layout. 100% reliable across Web, iOS, Android.      | **Chosen** |

### Decision: Platform-Specific Confirmation Alert

| Option                     | Tradeoff                                                                                                                             | Decision              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| React Native `Alert.alert` | Standard native dialog, but has no out-of-the-box support or may behave unexpectedly on custom Web configurations without polyfills. | Chosen (Native only)  |
| Web `window.confirm`       | Native browser confirmation. Lightweight and matches expected browser conventions.                                                   | Chosen (Web fallback) |

## Data Flow

    [ User Taps Input ] ────→ [ TextInput Focus / Keyboard Opens ]
                                          │
    [ User Taps Backdrop ]                ▼
              │                [ Has Unsaved Message? ]
              │                 /                   \
              │               Yes                    No
              ▼                ▼                      ▼
     [ Triggers dismiss ] ──→ [ Show Confirm Alert ]  [ Close Modal ]
                               /             \
                             No               Yes
                             ▼                 ▼
                       [ Keep Open ]     [ Close Modal ]

## File Changes

| File                                             | Action | Description                                                                                                           |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/ui/bottom-modal.tsx` | Modify | Restructure the modal wrapper to place the backdrop pressable as an absolute sibling to prevent touch event bubbling. |
| `apps/mobile/src/components/feedback-form.tsx`   | Modify | Implement autoFocus, intercept close actions, and show confirmation alert if unsaved message exists.                  |
| `apps/mobile/src/i18n/locales/en.ts`             | Modify | Add translations for the discard confirmation dialog (title, body, cancel, discard).                                  |
| `apps/mobile/src/i18n/locales/es.ts`             | Modify | Add Spanish translations for the discard confirmation dialog.                                                         |

## Interfaces / Contracts

No new interfaces or API changes are introduced.

## Testing Strategy

| Layer       | What to Test                       | Approach                                                                                                          |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Unit        | `BottomModal` Backdrop Press       | Verify that pressing the sibling backdrop triggers `onDismiss`.                                                   |
| Unit        | `BottomModal` Content Press        | Verify that pressing inside the content container does NOT call `onDismiss`.                                      |
| Integration | `FeedbackForm` AutoFocus           | Verify `autoFocus` prop is passed to `TwTextInput`.                                                               |
| Integration | `FeedbackForm` Confirmation Dialog | Mock `Alert.alert` and verify it is triggered when attempting to dismiss with text, and not triggered when empty. |

## Migration / Rollout

No migration required.

## Open Questions

None
