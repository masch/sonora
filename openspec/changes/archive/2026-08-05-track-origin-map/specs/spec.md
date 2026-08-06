# Spec: Track Origin Map Location

## Functional Requirements

1. **Map Display**: Replicate the map component experience used in `trips/deriva` to display the static origin point of a `track`.
2. **Static Origin Location**: Origin coordinates (`latitude` and `longitude`) are static properties sourced directly from the entity.
3. **UI Parity & Clean Design**: Reuse map props while stripping obsolete metadata text rows (Duration, Registry, Location) for a cleaner layout.

## Non-Functional Requirements

- **Strict TDD**: Write unit/integration tests first before component modifications.
- **Project Validation**: Ensure `make test` and `make lint` pass cleanly across the entire workspace.
