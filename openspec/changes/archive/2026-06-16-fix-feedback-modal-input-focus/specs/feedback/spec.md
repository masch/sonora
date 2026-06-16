# Delta Specification: feedback

## Modified Requirements

### Requirement: Feedback Form AutoFocus and Dismissal Confirmation

The feedback form modal MUST support automatic input focusing upon presentation. If the user attempts to dismiss the modal (via backdrop click or close button) while the text input is not empty, the system MUST show a confirmation dialog before discarding.

#### Scenario: AutoFocus on Open

- GIVEN the feedback form modal transitions to visible: true
- THEN the text input MUST automatically take focus AND the keyboard MUST open

#### Scenario: Dismiss empty form

- GIVEN the feedback input is empty
- WHEN the user taps the backdrop or the close button
- THEN the modal MUST close immediately WITHOUT showing a confirmation dialog

#### Scenario: Dismiss form with text (Discarded)

- GIVEN the feedback input contains "Great experience!"
- WHEN the user taps the backdrop or the close button
- THEN the system MUST present a confirmation dialog
- WHEN the user selects "Discard"
- THEN the modal MUST close AND the input text MUST be cleared

#### Scenario: Dismiss form with text (Cancelled)

- GIVEN the feedback input contains "Great experience!"
- WHEN the user taps the backdrop or the close button
- THEN the system MUST present a confirmation dialog
- WHEN the user selects "Keep Editing"
- THEN the modal MUST remain open AND the input text MUST be preserved
