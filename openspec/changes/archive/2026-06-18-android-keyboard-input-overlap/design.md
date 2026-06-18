# Design: Android Keyboard Input Overlap Fix

## Technical Approach

Restructure `BottomModal` to place `KeyboardAvoidingView` at the root of the modal content hierarchy. On both iOS and Android, we will use padding-based avoidance (`behavior="padding"`) to manually shift the layout when the keyboard is focused.

## Architecture Decisions

### Decision: Root-Level KeyboardAvoidingView

- **Choice**: Wrap the entire modal content hierarchy (backdrop + content container) inside `<KeyboardAvoidingView style={{ flex: 1 }}>`.
- **Rationale**: Wrapping the entire view allows the padding calculation to affect the whole Modal area. Since the modal's contents are aligned at the bottom using `justify-end`, adding bottom padding to the root container automatically pushes the bottom-aligned content above the keyboard.

### Decision: Padding-Based Avoidance on Android

- **Choice**: Set `behavior="padding"` on both iOS and Android.
- **Rationale**: Translucent status bars (`statusBarTranslucent={true}`) on Android render full-screen and disable the OS's native `adjustResize` behavior inside Modal windows. Therefore, we must use `behavior="padding"` on Android so that `KeyboardAvoidingView` manually applies the keyboard height offset as bottom padding.

## Data Flow

```
[User focuses TextInput] ──(focus event)──→ [Keyboard opens]
                                                    │
                                                    ▼ (KeyboardAvoidingView detects keyboard)
                                        [KeyboardAvoidingView adds bottom padding]
                                                    │
                                                    ▼
                                        [Content shifted up above keyboard]
```

## File Changes

| File                                              | Action | Description                                                                             |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/ui/bottom-modal.tsx`  | Modify | Move `KeyboardAvoidingView` to the root of the modal content; set `behavior="padding"`. |
| `apps/mobile/src/__tests__/bottom-modal.test.tsx` | Modify | Update unit tests to verify the behavior prop is set to `"padding"` on both platforms.  |

## Interfaces / Contracts

No public interfaces or props change.

## Testing Strategy

| Layer  | What to Test                                | Approach                                                                                |
| ------ | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Unit   | Render behavior and component props         | Verify `KeyboardAvoidingView` wraps layout and has the `behavior="padding"` prop.       |
| Manual | Focus text input on Android device/emulator | Verify the soft keyboard opens, the input field remains visible, and content shifts up. |
