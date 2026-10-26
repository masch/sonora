# Feature: Map Layer Selector

**Feature ID:** `map-layer-selector`
**Status:** contract defined and served behind a wire gate — no UI yet. The selector reaches the app once the renderer default is decided.

## Specs

**S1 — Show everything OSM shows in MapLibre, and let the client pick the layers**

> "lo que quisera, sin importar lo que hay hoy, es que se muestre todo lo que se ve en OSM en maplibre y que el cliente puede seleccionar por capas cual mostrar o no"

**S2 — The selector's configuration is changed from the backend, without compiling**

> "la cfg del selector se va apoder cambiar desde el back sin tener que compilar?"

**S3 — Leaflet support stays configurable while the migration is in progress**

> "el soporte leaftlet tiene que serguir siendo configurable, ya que estamos en transicion"

Corrected later: Leaflet is frozen — it keeps working as it does and receives no new work.

**S4 — A configuration field may reach the wire only when every build that can receive it tolerates it.**

## Tasks

- `T1` — contract in shared: `layers` on `RemoteConfigPayload.map`, and a `MapConfigSchema` that tolerates a field it does not know (done, `7d96168`).
- `T2` — gated wire: `/config` withholds `layers` until the installed base parses it, with the contract and forward-compatibility tests (this task).
- `T3` — group vocabulary and the capability contract: which groups each renderer can actually draw (in progress, `packages/shared/src/map/layer-groups.ts`).

  The vocabulary is seven groups, `roads`, `water`, `places`, `pois`, `boundaries`, `green`, `buildings`, resolved from the published Protomaps light style by two rules:

  - **Group ids are open.** `map.layers.groups[].id` stays a plain string on the wire; a build drops the ids it does not implement (`telemetry` from a newer server) instead of failing, so a payload can name a group before every client knows it.
  - **A layer belongs to the group whose prefix matches first**, and the always-on canvas layers (`background`, `earth`, `landcover`) are resolved before any group. Groups are prefix tables, not hand-kept id lists: `green` owns `landuse_*`, `buildings` owns `buildings` and `address_*`, `boundaries` owns `boundaries` and `boundaries_country`.

  The capability contract lives in the same module as data (`MAPLIBRE_LAYER_CAPABILITIES` with every group, `LEAFLET_LAYER_CAPABILITIES` with none), so the UI never branches on a renderer name. A group the renderer cannot toggle, or the payload never mentions, resolves to the built-in default of visible — today's drawing. `showLayerControl` is false when the payload says off or the renderer supports no group, because a control with nothing in it is worse than no control.

- `T4` — native MapLibre adapter: apply the resolution to the mounted style with `setLayoutProperty('visibility', …)` per style layer the group owns.
- `T5` — the control itself: trigger button, `BottomModal`, i18n labels, accessibility labels and testIDs, one row per resolved group.
- `T6` — decide the renderer default.

## Log

- `L1` — "lo que quisera, sin importar lo que hay hoy, es que se muestre todo lo que se ve en OSM en maplibre y que el cliente puede seleccionar por capas cual mostrar o no"
- `L2` — "la cfg del selector se va apoder cambiar desde el back sin tener que compilar?"
- `L3` — The independent verifier found that serving `map.layers` would break every already published build: their strict `MapConfigSchema` rejects the whole `map` object over the extra key, so the client would lose its renderer, its region catalog and its download policy. Decision: the API route strips `layers` from the wire until the installed base carries the tolerant schema.
- `L4` — The wire gate on `map.layers` stays until the implementation is complete: `apps/api/src/routes/config.ts` keeps stripping the field while `T4`/`T5` are outstanding. The project is in active development, so the gate is lifted in the same release that ships the control — an already published build never receives a field it cannot parse, and the release that does receive it is the release whose UI can use it.
