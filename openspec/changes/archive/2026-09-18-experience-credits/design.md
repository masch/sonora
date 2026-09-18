# Design: Dynamic Experience Credits (Spotify-style)

## Architecture Overview

Artistic credits in Sonora are heterogeneous and ordered. Storing them as a structured `jsonb` array in the `experiences` table provides maximum flexibility without requiring schema migrations whenever artistic roles or formats vary.

```
┌───────────────────────────────────────────────────────────┐
│                     PostgreSQL (API)                      │
│ experiences table -> column credits: jsonb                │
│ [{ role: "realization", names: "..." }, ...]              │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼ GET /experiences
┌───────────────────────────────────────────────────────────┐
│                    @sonora/shared                         │
│ BaseExperience.credits?: ExperienceCredit[]               │
│ ExperienceCredit: { role: string; names: string }         │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│                   apps/mobile Presentation                │
│ <ExperienceCredits credits={experience.credits} />        │
│ ├─ Spotify-inspired credit card at the bottom of detail   │
│ ├─ Clear visual hierarchy: Contributor names + Role label │
│ ├─ ThemedText & NativeWind tokens                         │
│ └─ Embedded below player in TrackDetailView & TripDetail  │
└───────────────────────────────────────────────────────────┘
```

## Data Modeling

### 1. `@sonora/shared`

In `packages/shared/src/experiences.ts`:

```typescript
export interface ExperienceCredit {
  role: string;
  names: string;
}

export interface BaseExperience {
  // ... existing fields
  credits?: ExperienceCredit[];
}
```

### 2. Drizzle Schema (`apps/api/src/db/schema.ts`)

```typescript
export const experiences = sonoraSchema.table('experiences', {
  // ... existing fields
  credits: jsonb('credits').$type<ExperienceCredit[]>(),
});
```

### 3. Seed Data (`apps/api/src/db/seed-data.ts`)

Populated for:

- `umepay-bosque` ("DERIVA DEL BOSQUE AL RÍO"):
  ```typescript
  credits: [
    {
      role: 'realization',
      names: 'Grupo Arquitectura del juego: Nachugo, Lucesypeces, Magali de Masi, Mara Ticach',
    },
    { role: 'musicalEditing', names: 'Max Delanian' },
    { role: 'musicOfTrees', names: 'Hila.musicadelasplantas' },
    {
      role: 'themeFeetInRiver',
      names: 'Mara Ticach, con colaboración de Clara Canale, Cande czarnowska, Max Delanian',
    },
    {
      role: 'Audio oceanomar',
      names: 'Matías Etcheguren sobre texto “Océano mar” de Alessandro Baricco',
    },
    { role: 'Voces', names: 'Chantal, Rafaela, Mara, Maga, Max, Luz, Fede' },
    { role: 'Objetos bosque', names: 'Lucesypeces' },
  ];
  ```
- `texto-maga` ("En Nogales, una vez"):
  ```typescript
  credits: [
    { role: 'Texto', names: 'Magali de Masi' },
    { role: 'Locución', names: 'Mara Ticach' },
    { role: 'Edición', names: 'Max Delanian' },
  ];
  ```

## UI/UX Design (Spotify-inspired Pattern)

### `ExperienceCredits` Component

Located at `apps/mobile/src/components/experience-credits.tsx`:

- Accepts `credits?: ExperienceCredit[]`.
- Returns `null` if `!credits || credits.length === 0`.
- Renders a dedicated card at the bottom of the details view (below the audio player and payment sections).
- Card container:
  - Translucent surface using `bg-white/40 dark:bg-zinc-800/40`, subtle border, and rounded corners matching Sonora's design tokens.
  - Header: `t('experiences.credits')` ("Créditos") in uppercase bold tracking.
- Row layout per credit:
  - Role: Uppercase, small, muted color (`colors.homeCardSubtext`) indicating the artistic discipline.
  - Names / Contributors: Emphasized text (`colors.homeCardText`), font-semibold, clean line breaks.
  - Subtle divider or vertical breathing space between entries.
- Accessibility: `testID="experience-credits"`, `accessibilityLabel`.

### Integration

- **`TrackDetailView`**: Positioned at the bottom of the card content, below the audio controls.
- **`TripDetailView`**: Positioned at the bottom of the scroll view / content area, below the audio controls.

## Internationalization

Add to translations in `apps/mobile/src/i18n/locales/`:

- `es.json`: `"experiences.credits": "Créditos"`
- `en.json`: `"experiences.credits": "Credits"`
