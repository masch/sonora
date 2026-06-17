# Spec: Android Keyboard Covers Feedback Input

## Requirements

### Requirement: Android Keyboard Avoidance

The feedback form modal MUST NOT be obscured or covered by the soft keyboard on Android devices when the text input has focus. The entire feedback modal layout (including the text input, submit button, and status indicators) must shift upward and adjust to the remaining screen height.

#### Scenario: Input focus shifts layout on Android

- GIVEN the feedback modal is open on an Android device
- WHEN the user taps/focuses the text input field
- THEN the soft keyboard opens
- AND the modal content container resizes and shifts up above the soft keyboard, keeping the text input and action buttons fully visible and interactive.

#### Scenario: iOS behavior remains unchanged

- GIVEN the feedback modal is open on an iOS device
- WHEN the user taps/focuses the text input field
- THEN the soft keyboard opens
- AND the modal content container shifts up above the keyboard using padding-based avoidance.
