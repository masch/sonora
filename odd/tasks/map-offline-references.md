# Feature: Offline OSM Map with Drawable References

**Feature ID:** `map-offline-references`
**Branch:** `feat/map-offline-references`
**Strategy:** `ask-on-risk`
**Status:** specs closed for phases 1–2; phase 3 specced but unscheduled.

## Objective

Replace the Leaflet-in-WebView map with MapLibre over self-hostable vector tiles, fed by **two data planes**:

1. **Base plane** — OSM vector tiles (PMTiles) carrying the classes the product decides to show, served from R2 and, in the future, generated with our own Planetiler profile.
2. **Reference plane** — our own GeoJSON documents (per experience or shared), editable from outside the app, drawn as MapLibre style layers on top, tappable to open a content card.

Both planes are rendered by one shared style, so mobile and web never diverge again. Offline packs let a walker keep full zoom without connectivity. A remote flag keeps the current Leaflet map alive during the transition.

## Specs

**S1 — Referencias dibujables, ajustables sin recompilar la app**

> "quiero agregar una funcionalidad nueva que en los maps de las experiencias se puedan cargar referencias a dibujar que no van a estar en OSM sino que van a hacer referencias sobre le mapa que pueda ir ajustando de forma externa que no tenga que recomilar la applicacion en cada cambio, como podemos encararlo?"

**S2 — Descarga online y zoom offline**

> "yo quiero que la persona pueda descargar todo online y luego pueda hacer zoom de forma offline de los mapas"

**S3 — Seguir usando OSM y aportar al servicio público**

> "Queremos seguir usando OSM porque queremos sumar informacion al servicio public"

**S4 — Convivencia de los dos mapas durante la transición**

> "es un proceso largo y hasta que lo cerremos me gustaria poder usar la visualizacion actual con leafct y también soportar el uso del mapa nuevo. una vez que cerremos funcinalmente el nuevo, borrariamos la version leaflet"

**S5 — Tomar las referencias de OSM y sumar las propias**

> "Yo quiero que mi implementacion de mapas tome y muestre todas esas referencias que ya existen en OSM publica y ademas pueda sumarle otras internas mediante un GeoJSON propio, como la ves?"

**S6 — Alcance confirmado de la solución**

> "tomo las referencias de OSM, le puedo sumar informacion extra al mapa que interactue con licks y zoom offline, exista el flag de modo actual realflet y modo nuevo para la transiccion"

**S7 — Mapa único futuro con selección de experiencias**

> "tener en cuenta que a futuro vamos a hacer un mapa unico general donde se pueda interactuar la seleccion de las experiencias"

## Decisions

| #   | Decision                                                                                                                                 | Source                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| D1  | MapLibre over Mapbox: Mapbox Terms forbid non-Mapbox tiles, cap offline tile counts, and would block publishing our own derived archive. | user asked "y la opción de mapbox como la ves?" |
| D2  | Start with route A: public Protomaps basemap (max zoom 15) served from R2; own Planetiler profile is phase 3, tracked in issue #502.     | user: "ok, vamos por la a"                      |
| D3  | Tapping a reference opens a **content card**; no audio/visited-state action in this feature.                                             | user choice, 1 of 4                             |
| D4  | Flag rollout: Leaflet stays the default, MapLibre is enabled per app version (server-side version gate).                                 | user choice, 2 of 3                             |
| D5  | The current Leaflet map is patched for OSM policy compliance now, instead of waiting for the removal.                                    | user choice, 1 of 2                             |
| D6  | Web stays online-only (browser cache); offline packs are native-only. Android browsers are already gated to the Play Store.              | proposed in design, not objected                |
| D7  | Style and `maxzoom` are served from R2 so changing tile depth never needs a release.                                                     | design constraint derived from D2               |
| D8  | The reference card shows description text, an image and an external link. No audio in this feature.                                      | user selection                                  |
| D9  | Reference labels and descriptions are i18n keys, not text inside the GeoJSON.                                                            | user selection                                  |
| D10 | References are authored through a token-authenticated admin API, not a repo script.                                                      | user selection                                  |
| D11 | Card images are served from the public bucket and uploaded from admin, because bundled assets would need a release per image.            | user selection                                  |
| D12 | Card links must be https and their host must be in an exported allowlist.                                                                | user selection                                  |

## Constraints & Conventions

- Signed-in surfaces follow `AGENTS.md`: `ScreenWrapper`, `ThemedText`, `Icon`, `Button`, `BottomModal`, `useAppTranslation`, `accessibilityLabel` + kebab-case `testID`, `LoadingView` for loading, explicit empty and error states.
- Referenced data model: `map_documents` (document JSON or asset, `scope: global | experience`, style, `zIndex`, `version`) plus `map_document_bindings` (N:N to experiences) so a shared reference is never duplicated per experience.
- `bbox` columns are computed at write time; no PostGIS.
- While both renderers live, `GET /experiences` stays a **superset** and no existing field changes.
- Overlay documents must travel in the offline-cached payload, or tappable references break without network.
- OSM attribution stays visible in every renderer; the derived archive is publishable under ODbL.

## Tasks

### Phase 0 — Compliance (done)

- [x] **T1: OSM tile policy in the Leaflet maps** — Refs: S3.
  - Path: `apps/mobile/src/components/track-detail-map.tsx`, `track-detail-map.web.tsx`, `apps/mobile/src/services/store-url.ts`, `apps/mobile/src/__tests__/track-detail-map.test.tsx`
  - Action: exact tile host, attribution with copyright link, app-identifying WebView `userAgent`; tests pin all three.
  - Proof: focused test 3/3 (RED observed first), mobile suite 96/795 exit 0, `tsc --noEmit` clean, `expo lint` exit 0.
  - Route: inline. Commit: `fix(mobile): comply with the OSM tile usage policy in Leaflet maps` (branch `fix/map-osm-tile-policy`).

### Phase 1 — Reference plane (no pipeline, no credentials)

- [x] **T2: Shared map document module** — Refs: S1, S5.
  - Path: `packages/shared/src/map/{document,schema,camera,style,map-like}.ts`, `packages/shared/src/__tests__/map.test.ts`
  - Action: types, GeoJSON subset Zod schema with limits, bounds math, style-layer builder, `applyMapDocuments(map, docs)` over a minimal `MapLike`.
  - Proof: shared suite 15 files / 217 tests (10 new); `typecheck` clean in both mobile and api workspaces; `expo lint` clean.
  - Route: inline. Commit: `5b32df0`.
  - Amended by D9-D12: properties now carry `labelKey`/`descriptionKey`/`imageUrl`/`linkUrl`, the style reads an injected `label`, and `withResolvedLabels` resolves keys before drawing.

- [x] **T3: API storage for reference documents** — Refs: S1, S5, S7.
  - Path: `apps/api/src/db/schema.ts`, `apps/api/migrations/0021_unique_rogue.sql`
  - Action: `map_documents` (key, scope, z-index, version, collection, bbox, published) plus `map_document_bindings` as an N:N join with cascade deletes; `toMapDocument` rebuilds the renderer-facing shape.
  - Proof: api suite 51 files / 578 tests; `tsc --noEmit` clean; migration is purely additive (one enum, two tables, no column changes).
  - Route: inline. Commit: `03ba622`.

- [x] **T3b: Documents in the experiences payload** — Refs: S1, S5, S7.
  - Path: `apps/api/src/routes/experiences.ts`, `apps/api/src/__tests__/experiences.test.ts`
  - Action: include published global documents plus the ones bound to the experience in `GET /experiences`, so they inherit the offline cache; both lookups happen once for the whole list, and a binding to an unpublished document is skipped.
  - Proof: api suite 51 files / 579 tests (new test covers global + bound + skipped-unpublished); `tsc --noEmit` clean in api and mobile; `expo lint` clean.
  - Route: inline. Commit: `7227f91`.

- [x] **T4: Map renderer, web** — Refs: S1, S4, S6.
  - Path: `apps/mobile/src/components/map/experience-map.web.tsx`, `apps/mobile/src/components/map/map-view.types.ts`, `apps/mobile/src/test-utils/*`, `apps/mobile/src/__tests__/experience-map-web.test.tsx`, `apps/mobile/package.json`
  - Action: a MapLibre GL web map that draws the documents from the experiences payload, resolves i18n keys into drawn labels, reports a tapped reference to the caller, and reads callbacks, translation and documents through refs so a re-render never rebuilds the instance. Adds `maplibre-gl` and `pmtiles` pinned exactly and past the release-age gate; jest maps `maplibre-gl` to a double because the package is ESM-only and needs WebGL.
  - Proof: mobile suite 96 files / 801 tests (9 for this component, including the regression that keeps the map from rebuilding on load); `tsc --noEmit` clean; `expo lint` clean; `expo export --platform web` exits 0 with the component included, bundling 136 `maplibregl` references and 199 `maplibregl-ctrl` rules from the node_modules stylesheet. Independently verified: the first version rebuilt the map on every render (verifier reproduced 1 load → 3 instances, 8 loads → 17); fixed before this commit.
  - Route: inline + independent verifier. Commit: `0d1a7a2`.

- [ ] **T4b: Map renderer, native** — Refs: S1, S4, S6.
  - Path: `apps/mobile/src/components/map/experience-map.tsx`, `apps/mobile/app.config.ts`
  - Action: the declarative MapLibre native map over the same documents and style builder, behind the dev build the native module requires.
  - Proof: dev build renders the same references; no web-only import reaches the native bundle.
  - Route: worker. Commit: pending.

- [x] **T4c: Both experience screens render the new map with the itinerary** — Refs: S1, S5, S6.
  - Path: `apps/mobile/src/components/map/{experience-map-switch,trip-map}.tsx` (new), `apps/mobile/src/hooks/use-map-view-config.ts` (new), `experience-map{,.web}.tsx`, `map-view.types.ts`, `apps/mobile/src/components/{track,trip}-detail-view.tsx`, `packages/shared/src/map/{itinerary,labels,map-like,document,schema}.ts`
  - Action: extract the renderer switch and the map config out of the track screen so both screens share them; derive one itinerary document per experience (origin, numbered stops, path, user location) drawn through the same `applyMapDocuments` path; `showLabels` toggles the label layer; the trip's map block moves to `TripMap` with its own toggle state, which keeps `TripDetailView` under the complexity threshold.
  - Proof: Jest covers the switch per renderer, the derived document, the label toggle, the hook resolution and the trip screen; shared 241 / api 599 / mobile 824 tests; `tsc --noEmit` in both workspaces; `expo lint`; `doctor-ci` 100/100, after a probe on the HEAD content proved the complexity warning was pre-existing. Also relaxes `MAP_LABEL_KEY_PATTERN`, which rejected the camelCase keys the locales actually use. The native parity defect the review found (R2-001, R3-001, R4-1) is corrected: the facade forwards the itinerary and a test mounts it directly.
  - Route: worker + inline. Commit: `438b558` + `ffb8770` (native facade correction, review-found).

- [x] **T5: Tap a reference to open its content card (web)** — Refs: S1, S6, D8, D9, D12.
  - Path: `apps/mobile/src/components/reference-card.tsx` (new), `apps/mobile/src/components/map/experience-map-switch.tsx`, `packages/shared/src/locales/{es,en}.ts`, `apps/mobile/src/__tests__/reference-card.test.tsx` (new), `apps/mobile/src/__tests__/experience-map-switch.test.tsx`
  - Action: `ReferenceCard` owns the `BottomModal`: the label the map already resolved as the title, the description translated from `descriptionKey`, the `imageUrl` image and one action button that opens `linkUrl`. The button only renders for an https URL whose host is in `MAP_LINK_ALLOWED_HOSTS` (the API rule restated on read, so a stored document can never hand the app an arbitrary host), and a key with no translation renders the key itself instead of an empty card. `map.openLink` added to both locales. The card's state lives in the switch, not in the screens: it belongs to the map that reports the tap.
  - Proof: RED observed first (the suite failed to import the component, and the map's press handler was not forwarded); reference-card suite 5/5 plus a tap → card test in the switch suite; mobile suite 104 files / 832 tests; shared vitest 18 files / 242 tests; `tsc --noEmit` clean in mobile; `expo lint` exit 0; `APP_VERSION_NAME=0.0.0-local bunx expo export --platform web` exit 0 with the component bundled. No interactive browser tap was performed in this environment: the modal shell and the card content are covered by Jest, the bundle by the export.
  - Route: inline. Commit: `eb46d588`.
- [ ] **T5b: Reference taps on native** — Refs: S1, S6. **Blocked by T4b:** the native facade still renders Leaflet and deliberately reports no taps, so there is nothing to wire until the native MapLibre map exists.
  - Action: forward `onFeaturePress` from the native map. The card itself needs no change: the same `ReferenceCard` opens from the same switch state.
  - Proof: a native tap opens the card; device check alongside T4b.

- [x] **T5c: Close the reference card advisories** — Refs: S1, S6, D8, D12.
  - Path: `apps/mobile/src/components/reference-card.tsx`, `apps/mobile/src/__tests__/{reference-card,experience-map-switch}.test.tsx`
  - Action: five non-blocking findings from the two reviews of the merged card. The real defect was `R2-001`/`R3-invalid-link-content`: `hasCardContent` counted the raw `linkUrl` while the button only renders for a link that passes the https + allowlist check, so a reference whose only payload was an unopenable link opened a titled, action-less modal — the empty-card class again, through the link door. `hasCardContent` now counts `canOpenLink`. `R2-003` extracted the title derivation into a documented `referenceTitle` helper with identical `??` semantics; `R2-004` brought the docblock in line with that rule; `R3-dismiss-coverage` pins dismissal and a later reopen, because a broken `onDismiss` used to pass; `R2-002`/`R3-itinerary-guard-coverage` now press the itinerary with real card content, so only the switch-level `ITINERARY_DOCUMENT_KEY` guard can keep the card shut — the old test would have passed with the guard deleted.
  - Proof: RED first for the link door (the new test failed with the titled, action-less modal); mobile suite 104 files / 839 tests; `tsc --noEmit` clean in mobile; `expo lint` exit 0; `prettier --check` clean on the three files. The two coverage items are tests over production code that was already correct, so no RED applies and none was fabricated.
  - Route: worker + parent. Commit: `365cf22`.

- [x] **T6: Authoring API for reference documents** — Refs: S1, D10, D12.
  - Path: `packages/shared/src/schemas/map-document.ts`, `apps/api/src/routes/map-documents.ts`, `apps/api/src/index.ts`, `apps/api/src/__tests__/map-documents.test.ts`
  - Action: `GET`/`POST`/`DELETE /map-documents` behind `adminAuthGuard()` + `validateJson()` + `dbGuard()`; the write validates the document, requires a bbox, rejects a global document that carries bindings, rejects a link outside the allowlist, requires a matching `social.instagramHandle` for instagram links, and requires every `labelKey`/`descriptionKey` to exist in `es` and `en`.
  - Proof: api suite 52 files / 585 tests; the new suite covers the missing translation, a non-allowlisted host, a foreign instagram profile, a global document with bindings, the stored bbox and the unauthenticated write; `tsc --noEmit` clean in api and mobile.
  - Route: inline. Commit: `c6b7780`.

- [x] **T6b: Reference image upload** — Refs: S1, D11.
  - Path: `apps/api/src/routes/media.ts`, `packages/shared/src/schemas/map-document.ts`, `apps/api/src/routes/map-documents.ts`, `apps/api/src/__tests__/media.test.ts`
  - Action: `POST /media/reference-images` behind the admin guard stores a UUID-keyed image in the public bucket after checking mime type and size, and returns the URL the document must use; `GET /media/public/:key` serves it unauthenticated with an immutable cache header; the document write path rejects an `imageUrl` outside that same origin and path. The schema accepts any absolute image URL on purpose, because the origin rule needs the request origin and local runs are http.
  - Proof: api suite 53 files / 591 tests; the new suite covers an accepted image, a rejected mime type, an oversize file, the unauthenticated upload, and the write path rejecting a foreign image host while accepting our own. `tsc --noEmit` clean in api and mobile; `expo lint` clean.
  - Route: inline. Commit: `f0ced90`.

### Phase 2 — Platform, offline and flag

- [ ] **T7: Dev-build spike with MapLibre + PMTiles offline** — Refs: S2.
  - Path: `apps/mobile/app.config.ts` (plugin), spike screen removed afterwards
  - Action: render `pmtiles://file://` on a device in airplane mode, measure size/memory/zoom.
  - Proof: device evidence on Android and iOS.
  - Route: inline (needs device + EAS). Commit: pending.

- [ ] **T8: Offline pack download and resolution** — Refs: S2.
  - Path: `apps/mobile/src/hooks/use-map-source.ts`, `use-map-offline-pack.ts`, download manager integration
  - Action: region-keyed pack download with progress, `file://` vs remote resolution, versioned paths.
  - Proof: Jest for resolution logic; device check offline.
  - Route: worker. Commit: pending.

- [ ] **T9: Style and maxzoom served from R2** — Refs: S2, D7.
  - Action: style JSON in R2 with `source.maxzoom` from pack metadata; app fetches and caches it.
  - Proof: changing the style in R2 changes the app map with no release.
  - Route: inline. Commit: pending.

- [ ] **T10: Renderer flag** — Refs: S4, S6, D4.
  - Path: `packages/shared/src/config.ts`, `apps/mobile/src/hooks/use-remote-config.ts`, `apps/mobile/src/components/experience-map*`
  - Action: `map.renderer` + `map.offlinePacks` in remote config, version-gated server-side, single facade decides.
  - Proof: resolver matrix tests (flag × capability × version); both renderers render the same references.
  - Route: inline. Commit: pending.

- [ ] **T11: Remove Leaflet** — Refs: S4.
  - Action: delete both Leaflet components, `react-native-webview`, the flag and its config field, in one commit.
  - Proof: no reference to Leaflet or the flag remains; suite green.
  - Route: inline. Commit: pending.

### Phase 3 — Own tiling profile (issue #502)

- [ ] **T12: `schema.yml` + measured build** — Refs: S3, S5.
  - Action: Planetiler `generate-custom` with named buildings first; record real archive size, wall time, working space.
  - Proof: named buildings visible in the viewer from an own archive; measured numbers recorded in #502.
  - Route: inline (needs JDK 21 + disk). Commit: pending.

- [ ] **T13: Tile pipeline and publishing** — Refs: S3.
  - Action: CI job (never EAS) publishing versioned archives to R2 with Range + CORS verified.
  - Proof: `curl -H "Range: bytes=0-99"` returns 206 with `content-range`.
  - Route: worker. Commit: pending.

- [ ] **T14: Re-tile cadence and stale-pack policy** — Refs: S2, S3.
  - Action: schedule, version manifest (`tilesMaxZoom`, `updatedAt`, `attribution`), refresh prompt for outdated packs.
  - Proof: documented procedure reproducible by someone else.
  - Route: inline. Commit: pending.

## Out of scope

- Modifying the upstream basemap profile; phase 3 uses our own schema instead.
- Offline packs on web.
- Server-side rendering of map images or static map previews.

## Open questions

1. Re-tile cadence and who runs it. Blocks T14.
2. `MAP_LINK_ALLOWED_HOSTS` currently allows `openstreetmap.org` and `instagram.com`. Confirm whether any other host is needed (project site, other social profiles). Blocks T6 validation rules.
3. Keep the hardcoded `'Pt 1'` strings in `track-detail-map.web.tsx`, or fix them to `t('map.point')` before deleting the file.
4. A reference that carries only a label now opens no card at all. Should the admin write path require `descriptionKey` (D8 says the card shows description, image and link), or is a silent label-only reference legitimate?

## Log

- **L1** (original request): "quiero agregar una funcionalidad nueva que en los maps de las experiencias se puedan cargar referencias a dibujar que no van a estar en OSM sino que van a hacer referencias sobre le mapa que pueda ir ajustando de forma externa que no tenga que recomilar la applicacion en cada cambio, como podemos encararlo?"
- **L2** (answers to scope questions): "1. Ambos / 2. no lo se todavia, evaluemos opciones, que diferencia hay entre tener un solo mapa compartido para todas las experiencias so tener uno para cada experiencia. tener en cuenta que a futuro vamos a hacer un mapa unico general donde se pueda interactuar la seleccion de las experiencias / 3. Sí, hay que resolver mapa base offline"
- **L3** (offline + OSM): "yo quiero que la persona pueda descargar todo online y luego pueda hacer zoom de forma offline de los mapas. Queremos seguir usando OSM porque queremos sumar informacion al servicio public"
- **L4** (engine question): "sigamos evaluend primero F0. y la opción de mapbox como la ves? es mejor o peor?"
- **L5** (transition flag): "es un proceso largo y hasta que lo cerremos me gustaria poder usar la visualizacion actual con leafct y también soportar el uso del mapa nuevo. una vez que cerremos funcinalmente el nuevo, borrariamos la version leaflet"
- **L6** (basemap ceiling reported): "en OSM los objetios se ven con z15, porque no lo veo en estE?"
- **L7** (concrete case): "En este map veo Noridza y Taller pero no en le ejemplo que armamos, porque?"
- **L8** (depth question): "ok y entonces para poder ver esos Datos como Centro Umepay, Bosque Umepay en nuestra nueva implementacion de maps en la app deberíámos usar zoom 16 y 17 si o si?"
- **L9** (requirements confirmation): "antes quiero confirmar si la solucion va a tener: tomo las referencias de OSM, le puedo sumar informacion extra al mapa que interactue con licks y zoom offline, exista el flag de modo actual realflet y modo nuevo para la transiccion"
- **L10** (card and authoring decisions, selected options): "Descripción de texto, Imagen, Enlace externo" · "Claves i18n en los locales" · "API admin con token" · "R2 público con subida desde admin" · "URL validada y whitelist de dominios"
- **L11** (allowlist answer): "instagram con handler sonora.derivapoetica"
- **L12** (native review of the branch candidate, lineage `review-fe4ff40301adcf79`): the provider ran four lenses plus a refuter and returned `correction_required` with four candidate-caused CRITICAL findings, all in code this branch introduced — R3-001 partial state when bindings cannot be written, R3-002 ignored zIndex draw order plus non-deterministic document order, R3-003 schema-accepted `minzoom` never applied, R3-004 label layer added to a style with no glyphs. Each is corrected with a test that fails without the fix, in the commit `fix(map): correct four findings from the native review` on the correction slice.
- **L13** (hosting decision, no custom domain): the public bucket is reached through `r2.dev`, which Cloudflare documents as non-production and which is not covered by its cache, so every byte-range read hits the R2 origin (latency reported at 500 ms or more). Instead of fighting that, the archive is small enough to download whole: the same model as the offline pack, one request instead of dozens, and a future custom domain becomes a pure gain with no client change. Internal references never enter the bucket: they travel in the authenticated experiences payload.
- **L14** (parity gap reported by the user): the new map was wired only into the track screen, because the renderer switch (`TrackMap`) was defined inside `track-detail-view.tsx`. A trip receives `mapDocuments` in the same payload and draws nothing, and never mounts the new renderer. Two further gaps surfaced while speccing the fix: `ExperienceMapProps.userCoordinates` is declared and unused (the new map draws no user location) and the new map has no labels toggle while the trip screen owns one. Chosen path: extract the switch so both screens share it and close the parity gaps with the Leaflet map's drawn set before the flag can be turned on.
- **L15** (native review of the branch, lineage `review-cf7b2daf08e1eb39`): the four lenses plus a refuter returned `correction_required` with three CRITICAL findings — R2-001, R3-001 and R4-1 — which are one root defect reported three times, all `introduced` and `deterministic`: the native facade is typed `ExperienceMapProps` but forwarded only the camera, the walker position and the labels flag, so the itinerary the switch derives was silently discarded on native and the parity claim held on web only. Corrected in `ffb8770` (the waypoints reach the props, the facade forwards them, the switch hands them to both branches, and both docblocks stop claiming parity), then reviewed and **approved** as its own candidate in lineage `review-4d95af637aca95f6`, with two non-blocking `informational` findings (R3-1, R4-001, both at `experience-map.tsx:14-18`). The first lineage stays parked in `correction_required`: its intended-untracked selection binding is rejected by both the facade and the native CLI (`must be exact … JSON`) after six attempts that never mutated anything — a provider defect, not a transcription error.
- **L16** (fourth review, lineage `review-154c2a7dd5515993`, branch against main): the four lenses plus a refuter found three CRITICAL findings in `use-map-source.ts`, all `introduced`: the hook ignored a changed `styleUrl` once the archive was registered, so a style rolled through the remote config never reached a client that already had that archive (`R1-001`, `R4-1`), and it kept one cancellation flag for the whole hook, so a superseded download could write its result after the current one and leave the map on `loading` with no request behind it (`R3-1`). Corrected in `814d7ef` — style cache keyed by style url, per-run cancellation, pending result identified by `(key, styleUrl)` — and approved through a targeted validation, leaving eleven advisory findings as later work. Two process lessons: this lineage reviews `committed-only`, so a correction has to be committed before the provider can see the corrected candidate; and the facade rejects the provider's correction-plan binding as stale while the native CLI accepts the very same tokens — the second non-reviewer binding class the facade refuses, after the untracked selection.
- **L17** (T5 split after the merge of #517): the task as written asked for the press contract "on both platforms", but native has no map that can report a tap until T4b lands, so the task was split instead of left half-done and checked: T5 is the card plus the web wiring, verified now, and T5b is the native wiring, blocked by T4b. The card is deliberately a plain component fed by `MapReferencePress`, so T5b only forwards the callback. Committing this slice hit an environment blocker: the repository signs commits and `gpg`'s pinentry timed out twice while the checks themselves passed; the signed commit `eb46d588` landed once the key was unlocked.
- **L18** (fifth review, lineage `review-bea0c926413a2783`, T5 candidate against `main`): tier `medium`, 7 files, 249 changed lines, three lenses — risk, readability, reliability — one reviewer each, all through the Pi host relay, no refuter and no correction: the candidate was **approved** on the last admitted event (`store_revision: sha256:a9b8eefb46c1b572918668142dd808b86bdef21cd88c461c39e2fd4fe4eaaf8f`) and its authority burned through `review.acknowledge-approved`. Four `informational` findings, none of them blocking and none reopening the review: `R1-001` (risk, WARNING, `reference-card.tsx:49-57`), `R2-001` and `R2-002` (readability, SUGGESTION, `reference-card.tsx:29-35` and `:21-22`) and `R3-dismiss-coverage` (reliability, SUGGESTION, `experience-map-switch.test.tsx:286-302`). They stay as later work; the review is not re-run for them. Two process lessons: `assess` reports "no pending changes" while the slice is already committed, so the tier has to be asked for a committed range (`baseRef` + `committedOnly`), where the same candidate read `reviewDue: false` (`under_budget`) and only the extension's reminder started the review; and the eligible host resolved START's consent itself, so the START returned `reviewing` instead of an envelope to relay.
- **L19** (CodeRabbit review of PR #520, corrected in `4c0f033`): CodeRabbit requested changes with one actionable finding, and this time the outside tool beat the lenses: the derived itinerary is drawn as `refs:itinerary:<kind>` layers, so it passed `documentKeyOfLayer` and opened a card with no reference metadata — a bare `Pt 1` for a numbered stop and the raw `Pt {{index}}` interpolation for the path, which has no `labelIndex`. Verified against `itinerary.ts` and the web click handler before touching code. Two independent guards instead of CodeRabbit's one-line suggestion: the switch drops presses whose `documentKey` is the shared `ITINERARY_DOCUMENT_KEY`, because the switch is the component that injects that document and the generic map must not learn about it; and the card only opens when the reference carries its D8 payload (a description, an image or a link), which kills the whole empty-modal class, not just the itinerary. The pre-existing tap fixture gained a `descriptionKey` because a label-only reference no longer opens anything (see open question 4). Proof: mobile 104 files / 836 tests, shared 18/242, `tsc --noEmit` clean, `expo lint` exit 0. Two lessons: three review lenses each checked a piece against its own contract and none audited the cross-document interaction — the moment a component starts consuming an event, audit every producer of that event; and CodeRabbit's docstring-coverage pre-merge check (66.67% vs 80%, not a required status on `main`) was cheap to clear by documenting the inner `openLink`.
- **L20** (sixth review, lineage `review-b6103f33053abfec`, the corrected candidate against `main` at `51f099a`): re-run over the whole slice after `4c0f033`, same three lenses through the host relay, tier `medium`, 330 changed lines. **Approved** on the last admitted event (`store_revision: sha256:b9855d0c44804baff92375b2e5ac0fb2b633b2c56f643a053e57fe54c446fbb2`) and burned through `review.acknowledge-approved`. Seven `informational` findings, none blocking: `R2-001` and `R3-invalid-link-content` (WARNING, both at `reference-card.tsx:41-43`), `R2-002` and `R3-itinerary-guard-coverage` (both at `experience-map-switch.test.tsx:310-325`), `R2-003` (`:29-35`), `R2-004` (`:21-23`) and `R3-dismiss-coverage` (`:286-308`). They join the later-work list; the review is not re-run for them. This entry was first written as its own commit on the branch GitHub had deleted at merge, so it landed with the T5c docs commit instead — pushing to a merged branch name recreates it and strands the commit outside `main`.
- **L21** (human decision on resuming): "1 y 2" — close the advisory findings and then take on the native map. Consequence, recorded before the code: the advisories became T5c (above, closed in `365cf22`), and T4b/T5b is authorized to add the native MapLibre dependency and its dev-build configuration, with the device proof still named as the one thing this environment cannot produce.
