# Proposal: Dynamic Experience Credits

## Intent

Support dynamic, ordered artistic and production credits for Sonora experiences (both `track` and `trip` formats), storing them as structured JSONB attributes on the experience entity and presenting them elegantly on the mobile detail views with theme-aware styling and internationalization.

## Scope

### In Scope

- **Shared Domain Model (`packages/shared`)**: Define `ExperienceCredit` interface (`role: string`, `names: string`) and add optional `credits?: ExperienceCredit[]` to `BaseExperience`. Add Zod validation schemas.
- **Database Schema (`apps/api`)**: Add nullable `credits` `jsonb` column to `experiences` table in `apps/api/src/db/schema.ts`.
- **Database Seeds (`apps/api`)**: Update `apps/api/src/db/seed-data.ts` with credits for:
  - `umepay-bosque` ("DERIVA DEL BOSQUE AL RÍO")
  - `texto-maga` ("En Nogales, una vez")
- **API Serializer (`apps/api`)**: Verify and ensure `credits` are returned in `GET /experiences`.
- **Mobile Component (`apps/mobile`)**: Create reusable `ExperienceCredits` component (using `Collapsible` or dedicated card section, `ThemedText`, and NativeWind tokens) with full i18n support.
- **Mobile Integration (`apps/mobile`)**: Integrate `ExperienceCredits` into `TrackDetailView` and `TripDetailView`.
- **Testing**: Unit tests for component rendering, empty state handling, accessibility attributes (`testID`), and API responses.

### Out of Scope

- Admin web portal WYSIWYG editor for credits (managed via database seeds/migrations and future CMS updates).
- Per-waypoint credits (credits belong to the parent experience).

## Capabilities

### New Capabilities

- `experience-credits`: Structured rendering and storage of multi-contributor artistic credits per experience.

### Modified Capabilities

- `experience-schema`: Extended `BaseExperience` with `credits?: ExperienceCredit[]`.
- `track-detail-view`: Integrated credits section.
- `trip-detail-view`: Integrated credits section.

## Approach

1. **Model**:
   Define in `packages/shared/src/experiences.ts`:

   ```ts
   export interface ExperienceCredit {
     role: string;
     names: string;
   }
   ```

   and add `credits?: ExperienceCredit[]` to `BaseExperience`.

2. **Persistence**:
   In `apps/api/src/db/schema.ts`, add:

   ```ts
   credits: jsonb('credits').$type<ExperienceCredit[]>(),
   ```

   to `experiencesTable`. Populate seed data in `apps/api/src/db/seed-data.ts`.

3. **Presentation**:
   Create `apps/mobile/src/components/experience-credits.tsx`:
   - Renders a list of `{ role, names }`.
   - Uses `Collapsible` or styled expandable section with `ThemedText` so credits don't clutter smaller screens while remaining easily discoverable.
   - Respects light/dark themes (`useThemeColors`).
   - Complies with AGENTS.md rules: testIDs, accessibility labels, no inline styles, no raw Text/View.

## Affected Areas

| Area                                                    | Impact   | Description                                               |
| ------------------------------------------------------- | -------- | --------------------------------------------------------- |
| `packages/shared/src/experiences.ts`                    | Modified | Add `ExperienceCredit` type and field to `BaseExperience` |
| `packages/shared/src/index.ts`                          | Modified | Export `ExperienceCredit`                                 |
| `apps/api/src/db/schema.ts`                             | Modified | Add `credits` jsonb column to `experiences`               |
| `apps/api/src/db/seed-data.ts`                          | Modified | Add sample credits to seeded experiences                  |
| `apps/mobile/src/components/experience-credits.tsx`     | New      | Reusable credits presentation component                   |
| `apps/mobile/src/components/track-detail-view.tsx`      | Modified | Render `ExperienceCredits`                                |
| `apps/mobile/src/components/trip-detail-view.tsx`       | Modified | Render `ExperienceCredits`                                |
| `apps/mobile/src/__tests__/experience-credits.test.tsx` | New      | Unit tests for credits rendering                          |
| `apps/mobile/src/i18n/`                                 | Modified | Add translation keys for credits label                    |

## Risks

| Risk                                 | Likelihood | Mitigation                                                                                                             |
| ------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Existing experiences without credits | High       | `credits` is optional (`nullable` in DB, `credits?: ExperienceCredit[]`), rendering gracefully handles empty/undefined |
| Long text on small screens           | Medium     | Clear typographic hierarchy with flex-wrap and accessible spacing                                                      |

## Rollback Plan

Field is optional and additive; removing UI renders and DB column does not impact core audio or geolocation playback.

## Success Criteria

- [ ] Credits appear formatted on both `TrackDetailView` and `TripDetailView`.
- [ ] Displays correctly for `umepay-bosque` and `texto-maga`.
- [ ] If an experience has no credits, no empty container or broken UI is displayed.
- [ ] Tests pass across API, shared, and mobile packages.
