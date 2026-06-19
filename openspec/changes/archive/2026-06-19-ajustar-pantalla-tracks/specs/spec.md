# Tracks Library Specification

## Purpose

Define the user interface and behavioral requirements for the tracks library in the mobile application, ensuring that the user can search and filter tracks by their respective categories.

## Requirements

### Requirement: SearchAndFilter

The interface MUST allow the user to search for tracks by entering text in a search input or by tapping a category tag.

#### Scenario: Filter by Category

- GIVEN the user is on the Tracks screen
- WHEN the user taps on the "Aves" category tag
- THEN only tracks categorized as "Aves" MUST be displayed in the list.

#### Scenario: Search by Text Query

- GIVEN the user is on the Tracks screen
- WHEN the user inputs "Azul" in the search bar
- THEN only tracks whose title or category contains "Azul" MUST be displayed.
