# Exploration: Dynamic Experience Credits

## Context & Problem

Sonora experiences (both `trip` and `track` formats) contain rich artistic, production, and musical collaborations (e.g. Realización, Edición musical, Música de las plantas, Locución, Guión/Texto, Voces, Objetos).
Currently, `BaseExperience` and the `experiences` database table only capture `title` and `description`.
There is no dedicated, structured way to store and display credits per experience.
Artistic credits vary dynamically per experience:

- Some experiences have 2 roles (e.g., Texto, Locución, Edición).
- Others have 7+ detailed credits (Realización, Edición musical, Música incidental, Colaboraciones, Voces, Objetos).

## Options Evaluated

### Option A: Unstructured Text / Markdown in `description`

- **Pros:** No schema changes.
- **Cons:** Breaks existing UI layouts, no semantic structure, difficult to format cleanly on mobile with Sonora's design tokens.

### Option B: Normalized Relational Table (`experience_credits`)

- **Pros:** Strict relational modeling.
- **Cons:** High ceremony, requires migration, complex joins in queries, inflexible when roles or metadata evolve.

### Option C (Selected): Ordered JSONB Array of Credit Items (`jsonb('credits')`)

- **Pros:**
  - Preserves exact authored display order.
  - Structure: `Array<{ role: string; names: string }>`.
  - Type-safe via Drizzle ORM `$type<ExperienceCredit[]>()` and `@sonora/shared`.
  - Seamless serialization in Hono API without extra joins or N+1 queries.
  - Native offline caching in SQLite KV store without extra tables.
  - Mobile UI component can simply map over the items cleanly.

## UI Placement Strategy

- In both `TrackDetailView` and `TripDetailView`, provide a dedicated section or `Collapsible` titled "Créditos" / "Credits".
- Renders each credit with the role highlighted (font-semibold / uppercase / accent) and contributors (clean readable body text) honoring Sonora's theme tokens.
