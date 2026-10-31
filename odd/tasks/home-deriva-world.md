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
