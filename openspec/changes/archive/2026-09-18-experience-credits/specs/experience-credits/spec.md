# experience-credits Specification

## Purpose

Define the functional and technical requirements for storing, transmitting, and displaying dynamic, ordered artistic and production credits for Sonora experiences across both track and trip formats.

## Requirements

### Requirement: Shared Domain Model for Credits

The system MUST represent credits as an ordered list of structured items containing `role` and `names` on the experience entity.

#### Scenario: Valid credits structure

- GIVEN an experience with artistic contributors
- WHEN parsed into `BaseExperience`
- THEN `credits` is an optional array of objects matching `{ role: string, names: string }`
- AND the authored array order is strictly preserved

#### Scenario: Experience without credits

- GIVEN an experience that has no defined credits
- WHEN parsed into `BaseExperience`
- THEN `credits` is `null` or `undefined`
- AND the rest of the experience remains fully valid

### Requirement: Database Storage and Persistence

The database MUST store credits on the `experiences` table as a `jsonb` column preserving order and allowing nullability.

#### Scenario: Experience with credits persisted and queried

- GIVEN the database has an experience with credits populated in JSONB format
- WHEN queried via API `GET /experiences`
- THEN the credits array is returned in the experience payload without modification or extra queries

### Requirement: Mobile Credits UI Component

The mobile application MUST render experience credits cleanly in both `TrackDetailView` and `TripDetailView` using theme-aware components, proper internationalization, and accessibility identifiers.

#### Scenario: Render credits when present

- GIVEN a user views a track or trip with populated credits
- WHEN the detail view renders
- THEN a "Créditos" section is displayed
- AND each credit entry displays the role and corresponding contributor names
- AND an accessible `testID="experience-credits"` is present

#### Scenario: Omit credits section when absent

- GIVEN an experience has no credits or an empty credits array
- WHEN the detail view renders
- THEN no credits section or empty placeholder card is shown
