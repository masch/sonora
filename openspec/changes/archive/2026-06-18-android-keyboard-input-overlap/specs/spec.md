# Spec: Android Keyboard Input Overlap Fix

## Capabilities

### bottom-modal

The bottom modal sheet component MUST support dynamic keyboard avoidance on both iOS and Android platforms, automatically shifting the layout when the keyboard is focused and preventing user input fields from being overlapped.

## Requirements

### Requirement: Root-Level Keyboard Avoidance

The `BottomModal` MUST wrap all modal content in a root-level `KeyboardAvoidingView` to ensure proper layout calculations.

- The `KeyboardAvoidingView` MUST have a `flex: 1` style to occupy the full modal screen area.
- The `KeyboardAvoidingView` MUST use `behavior="padding"` on both iOS and Android to manually apply bottom padding when the keyboard is shown.

#### Scenario: Keyboard opens on Android shifts layout

- GIVEN the `BottomModal` is open on Android
- WHEN the user focuses a text input inside the modal
- THEN the soft keyboard is displayed
- AND the `KeyboardAvoidingView` offsets the content by adding bottom padding equal to the keyboard height, keeping the input visible.

#### Scenario: Keyboard opens on iOS shifts layout

- GIVEN the `BottomModal` is open on iOS
- WHEN the user focuses a text input inside the modal
- THEN the soft keyboard is displayed
- AND the `KeyboardAvoidingView` offsets the content by adding bottom padding equal to the keyboard height.
