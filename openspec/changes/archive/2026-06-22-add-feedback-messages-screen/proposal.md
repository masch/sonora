# Proposal: Add Feedback Messages Screen

## Intent

Provide community transparency and allow users to read messages/feedbacks left by other walkers regarding tracks and trips. The goal is to build a vibrant sense of community where users can share their feelings, nature observations, and status updates of the local environment. It also allows walkers to leave comments at any point in their walk (not only at the end).

## Scope

### In Scope

- Create a new tab page **"Mensajes"** (in Spanish) in the tab bar.
- Add and display a feed of messages (feedbacks) filtered by sub-tabs: "Todos" (all) and "Cercanos" (nearby).
- Store location coordinates (latitude and longitude) when creating a feedback.
- Modify the database schema (`sonoraSchema.feedback` table) to store latitude and longitude.
- Update client storage queue to include location info when offline, syncing automatically when connectivity is restored.
- Allow users to write and submit a new message at any time from this new tab screen (reusing the same feedback modal flow).
- Integrate the navigation from the Home screen's "Mensajes del lugar" menu item.

### Out of Scope

- Bookmark or saving messages locally (Guardados).
- Interactive actions such as playing audio recorded by other users.
- Backend geofencing query logic (filtering "Cercanos" will be performed client-side using coordinate distance metrics).

## Capabilities

### New Capabilities

- `feedback-feed`: Allows users to fetch, filter, and view feedbacks left by the community.

### Modified Capabilities

- `feedback`: Enhances the feedback submission logic to include user's current GPS coordinates at the time of creation, and allows triggering feedback creation manually from the Messages tab.

## Approach

1. **Database Schema Update**: Add `latitude` and `longitude` fields to the `sonora.feedbacks` table. Update type schemas (`@sonora/shared` and API validation).
2. **API Endpoint Expansion**:
   - Add a `GET /feedback` route to retrieve the list of all feedbacks.
   - Update `POST /feedback` to accept optional `latitude` and `longitude` fields.
3. **App Navigation**:
   - Enable `SHOW_LOCAL_MESSAGES = true` on `HomeScreen`.
   - Add `/messages` route to the tab navigation stack using `app-tabs.tsx` configuration.
4. **Client UI Layout**:
   - Create `src/app/(tabs)/messages.tsx` with tabs: Todos and Cercanos.
   - Reuse existing themes and CSS tokens, conforming to the modern aesthetic layout showing cards with text/icons and metadata.
   - Add a "+ Mensaje nuevo" button that opens the existing feedback submission form.
5. **GPS integration**: Capture current location from `useLocationStore` at the moment of feedback creation and queue it.

## Affected Areas

| Area                                          | Impact   | Description                                                     |
| --------------------------------------------- | -------- | --------------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                   | Modified | Add GPS fields to feedback table schema.                        |
| `packages/shared/src/feedback.ts`             | Modified | Update Zod schema to validate coordinates.                      |
| `apps/api/src/routes/feedback.ts`             | Modified | Add `GET /feedback` endpoint and update `POST` handler.         |
| `apps/mobile/src/types/feedback.ts`           | Modified | Update `FeedbackEntry` to include coordinates.                  |
| `apps/mobile/src/storage/feedback-storage.ts` | Modified | Enhance client storage fields.                                  |
| `apps/mobile/src/app/(tabs)/index.tsx`        | Modified | Enable menu button navigation.                                  |
| `apps/mobile/src/constants/tabs.ts`           | Modified | Add "messages" tab configuration.                               |
| `apps/mobile/src/app/(tabs)/messages.tsx`     | New      | Main screen with feed, sub-tabs, and "+ Mensaje nuevo" trigger. |

## Risks

| Risk                       | Likelihood | Mitigation                                                    |
| -------------------------- | ---------- | ------------------------------------------------------------- |
| No GPS lock when sending   | Med        | Allow fallback to null/undefined or use track starting point. |
| Large offline payload size | Low        | Keep local feedbacks small and prune queue database on sync.  |

## Rollback Plan

Revert Git commits, undo database schema changes, and restore the previous build packages.

## Dependencies

- API deployment with updated table schema.
- GPS permission status.

## Success Criteria

- [ ] Users can navigate to the messages tab and see community feeds.
- [ ] Users can toggle between "Todos" and "Cercanos".
- [ ] Submitting feedback from the screen or track ends sends current coordinates to the server.
