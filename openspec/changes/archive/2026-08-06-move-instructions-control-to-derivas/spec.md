# Feature Specification: Relocate Instructions Audio Control

## Requirements

### Requirement 1: Home Screen Cleanup

- **Description**: The Home screen MUST NOT contain the instructions audio player control or initiate instruction audio loading on mount.
- **Scenario**: User views Home screen
  - **Given** the user navigates to the Home tab (`/`),
  - **Then** the `HomeAudioPlayer` component is not rendered.

### Requirement 2: Derivas / Tip Screen Instruction Control

- **Description**: The Derivas/Tip screen MUST render the instructions audio control positioned directly below the search bar and category filters.
- **Scenario**: User views Derivas/Tip screen
  - **Given** the user navigates to the Derivas/Tip screen,
  - **Then** the instruction audio player component is displayed below the category filter chips and search input.

### Requirement 3: Instruction Item Removal from Experiences List

- **Description**: The instructions experience item MUST NOT appear as a regular card in the Derivas list.
- **Scenario**: Experiences list rendering
  - **Given** experiences are fetched from the API,
  - **Then** items matching the instructions slug/id or published status are excluded from the main list view.
