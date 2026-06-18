# Proposal: UI/UX Aesthetic and Home Screen Redesign

We will apply the first slice of the new UI/UX design matching the "field notebook" (cuaderno de campo) aesthetic. This change focuses on setting up the global colors/theme and redesigning the Home screen layout.

## User Review Required

> [!IMPORTANT]
>
> - **Theme Colors**: Background changes to a warm cream (`#F4EDE2`) and text to charcoal/pencil (`#2B2826`). This affects the entire application where global theme tokens are used.
> - **Home Screen Structure**: The Home screen will no longer render the list of tracks/trips directly (`TripMap`). It will render the dashboard layout shown in the "1. HOME" mockup.

## Proposed Changes

### Theme & Styling

#### [MODIFY] [global.css](file:///home/masch/dev/js/sonora/apps/mobile/src/global.css)

Update `@theme` color variables to matching field notebook warm palette.

### Home Screen

#### [MODIFY] [index.tsx](<file:///home/masch/dev/js/sonora/apps/mobile/src/app/(tabs)/index.tsx>)

Redesign to implement:

- Header with logo & title.
- Placeholder for the hand-drawn style illustration.
- "Continuar escuchando" card.
- List items for "Explorar recorridos", "Explorar tracks", and "Mensajes del lugar" routing.

## Verification Plan

### Automated Tests

- Run `make check` and `make test-mobile` to ensure the Home screen tests are updated to match the new structure and pass successfully.

### Manual Verification

- Verify the Home screen renders with the correct cream/charcoal colors, responsive layouts, and proper navigation paths.
