# Dynamic Categories Specification

## Purpose

Define the requirements for dynamic category management, allowing category definitions to be retrieved dynamically from the backend rather than being statically hardcoded.

## Requirements

### Requirement: DynamicRetrieval

The system MUST fetch category tags from the backend database to display in the user interface.

#### Scenario: Populate Category Chips

- GIVEN the application is starting or refreshing
- WHEN the category chips are rendered
- THEN the system MUST fetch the category keys and localized labels from the API
- AND render them dynamically in the category selection carousel.
