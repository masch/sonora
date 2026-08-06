# Feature Specification: Relocate Instructions Audio Control

## Requirements

### Requirement 1: Home Screen Cleanup

- **Description**: The Home screen MUST NOT contain the instructions audio player control or initiate instruction audio loading on mount.
- **Scenario**: User views Home screen
  - **Given** the user navigates to the Home tab (`/`),
  - **Then** the `HomeAudioPlayer` component is not rendered.

### Requirement 2: Derivas / Tip Screen Instruction Control

- **Description**: The Derivas/Tip screen MUST render the instructions audio control and allow users to play/pause instructions.
- **Scenario**: User views Derivas/Tip screen
  - **Given** the user navigates to the Derivas/Tip screen,
  - **Then** the instruction audio control is displayed and functional.
