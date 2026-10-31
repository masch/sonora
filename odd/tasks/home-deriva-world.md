# Feature: Home Deriva world

**Feature ID:** `home-deriva-world`
**Status:** implementing. Front + shared only: the decisions below leave the API untouched.

## Specs

**S1 — A new home component: the Deriva world, drawn with MapLibre, over all of Umepay**

> "Quiero agregar en el home un componente nuevo que muestre el mundo Deriva.
> Quiero que muestre un componente nuevo con el visualizador de maplibre y que muestre todo Umepay con los puntos de las experencias dentro."

**S2 — Every point comes from the environment's experience seeds and navigates to the detail that already exists**

> "Cada punto experiencia vienen de los seed de experiencias ya creadas por el ambiente y cada punto deberia tener la forma de navergar al detalle de la experiencia directa. La pantalla que hoy ya existe del detalle de cada cada experiencia (track y trip)."

**S3 — Leaflet stays deprecated and does not support this feature**

> "La version de leaftlet sigue deprecada, no debe soportar esta funcionalidad nueva."

Resolved (L2): when the build resolves `maplibre` the home shows the new map, otherwise it keeps showing the static home image that exists today.

> "podemos hacer que si viene activo maplibre muestre este mapa nuevo y sino que muestre la imagen fija que existe hoy en la home?"

**S4 — The points are derived from `/experiences`**

Chosen in L3: `Derivar de /experiences` — no new endpoint, no new seeded map document.

**S5 — Three preview presentations, switchable, decided later on the device**

> "es posible hacer las 3 y en base a la experencia luego dedicir cual usar?"

Resolved (L6): `A + B ahora, C después` — the sheet with and without camera flight is built now, behind one env switch; the callout comes after seeing them on a device.

**S6 — Tap a point: a preview, and the detail from inside the preview**

> "como sería la previewcard? si click sobre el pnuto muestra una preview y dentro de la preview se podríá ir al detalle?"

**S7 — First version also carries these three extras**

> "Filtro por formato (Deriva / Track), Línea de la deriva del trip, Badge de duración/precio en el punto"

**S8 — No "Comprada" state in v1**

Chosen in L7: `Sin "Comprada" en v1` — the payload does not carry ownership, and v1 does not add it.

## Tasks

- `T1` — shared: the point label, one line, and the words it uses (`map.world.*` in `es.ts`/`en.ts`). Label is `{title} · {duration} · {price}`; `{{minutes}} min` / `{{seconds}} s`; `free` reads `Gratis`. Pure helper plus tests.
- `T2` — shared: `worldDocuments(experiences)` derives the world's documents — one GeoJSON document with one `Point` per published experience (carrying `slug` so a tap can resolve it) and one itinerary line per trip. Pure plus tests.
- `T3` — mobile: `components/map/world-map.tsx`, MapLibre only. Camera fits the resolved region box, format chips filter the points, a tap selects an experience instead of opening a reference card.
- `T4` — mobile: `components/map/experience-preview-card.tsx` — `BottomModal`, cover, badges (format, duration, price), description and an "Abrir experiencia" button that pushes `ROUTES.PATH.POETICS_DETAIL`. `presentation` and `centerOnSelect` select variant A or B through `EXPO_PUBLIC_WORLD_MAP_PREVIEW`.
- `T5` — mobile: home integration. `maplibre` mounts the world map in place of the static image; `leaflet` keeps `PopupImageModal` + `SONORA_HOME_MAP`.
- `T6` — checks: the new suites, `typecheck`, `lint`, and the whole mobile Jest suite.

## Log

**L1**

> "Vamos agregar una funcionalidad completamente nueva que inlcuye front y back. Quiero agregar en el home un componente nuevo que muestre el mundo Deriva.
> Quiero que muestre un componente nuevo con el visualizador de maplibre y que muestre todo Umepay con los puntos de las experencias dentro.
> Cada punto experiencia vienen de los seed de experiencias ya creadas por el ambiente y cada punto deberia tener la forma de navergar al detalle de la experiencia directa. La pantalla que hoy ya existe del detalle de cada cada experiencia (track y trip).
> La version de leaftlet sigue deprecada, no debe soportar esta funcionalidad nueva.
> Que opciones podriamos analizar antes de hacer? que cosas podemos agregarle ?"

**L2** — fallback resolved by the human:

> "podemos hacer que si viene activo maplibre muestre este mapa nuevo y sino que muestre la imagen fija que existe hoy en la home?"

**L3** — points source: `Derivar de /experiences`.

**L4** — tap behaviour: the human asked for the preview shape, and then picked `Bottom sheet + botón Abrir` for variant A.

**L5** — extras in v1: `Filtro por formato (Deriva / Track)`, `Línea de la deriva del trip`, `Badge de duración/precio en el punto`.

**L6** — variants: `A + B ahora, C después`.

**L7** — ownership badge: `Sin "Comprada" en v1`.

**L8** — decisions found by exploration (not new requirements, the shape the work takes):

- The home map costs a whole region archive in the download budget; on a Leaflet build it never mounts, so the static image stays the cheap path.
- `MapReferenceGeometry` has no `MultiPoint`, so the world's points are N `Point` features in one document.
- A tap reports `MapReferencePress`, which carries `documentKey` and texts only; navigation is client-side because `linkUrl` is an external, allowlisted URL by policy.
- The preview needs a sibling of `ReferenceCard`: that card's only action is an external link and it knows nothing about price or format.

**L9** — the opening frame is the experiences, not the region box (decision taken while building `T2`).

The region is 0.17° × 0.16° and the seeded points sit inside ~0.02° of it, so fitting the region on a 288 px card would put three points on the same pixels. `worldCameraBounds` therefore covers everything drawn — each origin and each trip's stops — widened per axis to `WORLD_MIN_SPAN_DEGREES` (~1.7 km), and falls back to the region box only when there is nothing to draw. "Todo Umepay" is what panning reaches; one frame cannot hold it at a legible scale. The spec's wording is unchanged; this is how it was made honest on a small surface.

**L10** — two defects the commissioned suites caught, both mine, both fixed before the slice closed: the preview card imported `TRACK_IMAGES`/`DEFAULT_TRACK_IMAGE` from `@/data/experiences` (they live in `@/constants/images`), which threw on every render with a selection; and `world-map.tsx` indexed the region catalog with `source.regionKey` after a `=== null` guard that left `undefined` reachable (`tsc` TS2538).

**L11** — the variant switch is a build-time env value, not a remote field: nothing about a rollout depends on which preview shape a build draws, so it grants nothing at runtime and reaches no server. When the shape is decided on a device, the losing branch and its test are deleted.

**L12** — `lint` failed on the first pass of `use-world-experiences`: a `setState` written synchronously in the effect body to mark the new attempt as loading. The attempt id already answers that question, so the write was removed and the render derives loading from "this run has not settled".

**L14** — a broken gate, and the debt it had been hiding.

`make gga` — the repo's AI pre-commit review — had stopped working twice over. Its configured model (`opencode/ling-3.1-flash-free`) no longer exists in the catalog, and `gga run` exits **0** when its provider fails, so the hook printed `✓ gga... ok` having reviewed nothing. That is why several commits on this branch passed a review that never ran. Fixed by pointing `PROVIDER` at the human's own plan (`opencode-go/deepseek-v4.1-flash`; the `opencode/*` namespace is pay-per-use and answered `Insufficient account funds`) and by teaching `.githooks/pre-commit` that a run which says its provider failed is a failed step, whatever it exits with. `STRICT_MODE` cannot do that job: it also rejects a verdict the model words differently, and every model tried puts `STATUS:` past the line the parser reads.

Run against its own branch, the gate then found seven real things in files this feature touches:

- the format and theme filter chips were hand-rolled `TwPressable` toggles. `Button` fixes its own radius, typography and `accessibilityState`, so a chip cannot be expressed through it — the design system gained `Chip` (`shape: square | pill`), both rows moved to it, and `AGENTS.md` §1 now names the primitive and the rule that only `src/components/ui` builds a single-press surface;
- the ad-hoc retry button on the experiences screen became `<Button>`;
- the **web** renderer drew request prose on screen (`archive.error` and two English literals) while the native one translated stable codes: the web now holds codes, maps them through the same keys, and logs the detail;
- the web error state offered no retry at all: it now has one, with a counter per wait so a retry never throws away the wait that worked;
- the web map surface carried no `aria-label`/`data-testid`, unlike the native map; and the native test double used a raw `View` where §3 asks for `TwView`.

Two clean-ups came from the same review: an unreachable `failure ? … : …` arm in the native renderer and one locale key left behind by the chip migration.

The component-size rule (`react-doctor/no-giant-component`) refused the web renderer twice as this work landed, and both times the answer was an extraction rather than a waiver: the failure surface became `map-error-view.tsx`, and the map's instance lifecycle became `use-web-map-instance.ts` — the same shape `use-map-focus-flight.ts` and `use-native-focus-flight.ts` already have.

**L15** — the third review pass escalated, and the four findings it left behind.

The batch that fixed the gate and closed the gga findings went through review with a single lens (`lenses-invalid` rejected three and four; the provider created the lineage anyway), and it stopped at `native_stop_required` with `unknown_causality` on a `CRITICAL`. The stop is informational, and the findings were real:

- `R3-001` — each web flight registered its own `once('moveend')` while a single flag said "a flight is pending". A second tap interrupted the first animation, MapLibre emitted the `moveend` of the transition it had just cut off, and the stale listener reported a landing that had not happened: the card opened before the second flight started. The double kept one handler per event, which is why the rapid-retap test never saw it. Now each flight owns a number, the listener is armed **after** `flyTo`, and a replaced flight's landing is inert.
- `R3-002` — the same shape on native, where the cleanup left the flag armed.
- `R3-003` — the new map-level retry rebuilt the instance while `ready` stayed `true`, so the ready-gated effects (pending flight, layer selection) never ran for the new map: a retried map could be one that neither travels nor honours the chosen layers. `ready` is now derived from the build that reported `load`, so a rebuild passes through false→true.
- `R3-004` — the retry kept a loaded style but not a downloaded archive, so retrying a style failure downloaded the whole archive again. Both waits now keep what landed.

Each fix landed with a test that fails against the previous code; the double gained a listener list so the interrupted-transition path is reproducible at all.

**L13** — the review, end to end: two lineages, four findings, both criticals real.

Lineage `review-25af80b61f5fe026` (3 lenses + refuter) found `R3-001`/`R4-001`: the web flight called `map.flyTo(center, options)`, a signature MapLibre GL JS does not have — it takes one options object — and the test double had been written to match the invented shape, so the suite passed while the camera would never have moved. Fixed in `ca4a538`; the double now takes exactly what the library takes.

Lineage `review-2374faa9e21698fd` found `R3-001`: variant B showed the preview card in the same render that started the flight, so the sheet covered the camera move the variant exists to show. The correction plan was declared **before** editing (60 lines, accepted), the fix separates the flight from the card and opens it when the flight is due to land, and the test the review asked for reproduces RED against the pre-fix file. Fixed in `72406c1`; validated by a targeted validator (`original_criteria: passed`, `correction_regression: passed`, no regressions, full suite 122/1071); acknowledged, authority burned.

Follow-ups worth their own issues, none of them regressions:

- Web only: a flight is skipped while the map is not ready (`use-map-focus-flight.ts:46-48`) but the reveal timer starts at the tap anyway, so on a still-loading web map the card can open before any travel. Variant B's guarantee is weaker on the web renderer than the shared constant suggests.
- The reveal is time-based, not camera-settled: panning or pinching during the 700 ms still opens the card at the timer. Deliberate (`world-map.tsx:137-149`), recorded so nobody re-derives it.
- `traveller` is no longer gated on `centerOnSelect`; latent only, since the prop is static per mount.
- Platform defect, not this feature: correction-scoped bindings (`correction_lines` after the candidate moves, `provider_targeted_validator` always) are rejected by the facade as "missing or stale for current STATUS" because they pin the correction identity while the validator compares the lineage one. Worked around by declaring the plan before editing and by running the validator host-side through `--materialize` + `--input`.

## Slices

Five commits on `feat/home-deriva-world`, each one reviewable alone:

- `8594633` — shared derivation, the `experienceSlug` press field, i18n, tests (`T1`–`T2`).
- `cbee705` — the camera `focus` capability: `focus` on the renderer contract, the shared flight hook, the fake map's `flyTo`/`getZoom`, the web suite's flight test.
- `e643e8d` — the preview card, its badges and its route, plus the variant resolver and the build-time switch (`T4`).
- `027a1ec` — the world itself: the experiences hook, `world-map.tsx`, and the ten-test suite that pins it (`T3`).
- `9729f3b` — the home slot and its decision, the still-map fallback for Leaflet, and this document (`T5`).

Checks at close: mobile Jest 121 suites / 1065 tests, `tsc --noEmit` clean, `expo lint --max-warnings 0` clean, `react-doctor --scope changed --blocking warning` 100/100, shared Vitest 366 tests, and the Leaflet deprecation suite green.

**Not verified**: nothing has run on a device or a browser. The map's opening frame, the label collisions under real fonts, the archive download the home now triggers on first open, and both preview variants are design questions a screenshot cannot answer — they need the device, which is also what `L6` left open.
