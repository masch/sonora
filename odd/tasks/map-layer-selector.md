# Feature: Map Layer Selector

**Feature ID:** `map-layer-selector`
**Status:** contract defined, served behind a wire gate, and the control shipped (uncommitted): the selector draws itself only when the payload's `showControl` says so, and the flag now has a producer — only the wire gate (`L4`) is still outstanding.

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

- `T4` — native MapLibre adapter: apply the resolution to the style, as a pure transform (done, on the chained branch `feat/map-layer-toggle`; see the commit-independence caveat below).

  The work is `applyLayerGroups` in `packages/shared/src/map/layer-groups.ts`, called by `buildMapStyle` in `apps/mobile/src/components/map/experience-map.tsx` on the base layers, **before** the reference layers are appended, so a group can only ever reach the basemap. A hidden group's layers get `layout.visibility: 'none'`; a visible group's layers lose the key instead of gaining `'visible'`; the canvas (`background`, `earth`, `landcover`) and every unclaimed layer (`refs:*` among them) keep what they had; and when every group is drawn the array is returned as the same reference, so a style nobody asked to change is not rebuilt. The selection comes from `map.layers` — the payload the app already consumes, resolved once with `resolveLayerSelection(…, MAPLIBRE_LAYER_CAPABILITIES)` — and is memoised by content (`id:defaultVisible` list), because on native a new style object re-applies the style and re-fetches its tiles.

  Commit independence: this branch is cut from `feat/map-layer-groups`, not from `main`, because the vocabulary it consumes is not merged yet. It therefore cannot land on its own — it merges with (or after) that branch, and its diff is only meaningful against it.

- `T5` — the control itself: trigger button, `BottomModal`, i18n labels, accessibility labels and testIDs, one row per resolved group (done).

  `apps/mobile/src/components/map/map-layers-control.tsx` is a self-contained action: the trigger `IconButton` (`map-layers-control`) and its sheet live in one file, and no parent declares a `visible` flag. The sheet is a `BottomModal` titled `map.layers.title`, with one `TwPressable` row per resolved entry, in the order it arrives — `MAP_LAYER_GROUPS` decides that order upstream, and the control sorts nothing. A row is `accessibilityRole="checkbox"` with `accessibilityState.checked`, `testID="map-layer-row-${id}"` and a label that names the group _and_ its state (`map.layers.visible` / `map.layers.hidden`, interpolated with the group's own name), because a screen reader reads the state, not a check mark. It renders nothing at all when `showLayerControl(configured, capabilities)` is false. Its props are the selection, `onToggle(id)` and `allowed`: no renderer name appears in the file.

  The labels are new keys in the shared `map` block — `layers.title` plus one per group id, and the two state sentences — in `es.ts` and `en.ts`. The group→key table is typed `Record<MapLayerGroupId, TranslationKeys>`, so a group the vocabulary grows without a label is a type error instead of an empty row.

  What it does **not** do: the choice is not persisted. It is seeded once from the payload at mount and lives in the switch's state for the session — closing the map forgets it. Persistence (which store, and whether the walker's choice outranks a later payload) is the next task, `T7`.

  It also does not yet read the payload's own `showControl` flag end to end by itself: the flag reaches the control through `MapSourceConfig.showLayersControl`, which `useMapViewConfig` now fills from `map.layers.showControl` (see `L8`).

- `T6` — decide the renderer default.
- `T7` — persist the walker's choice: today it lasts as long as the mount does (see `T5`).

## Log

- `L1` — "lo que quisera, sin importar lo que hay hoy, es que se muestre todo lo que se ve en OSM en maplibre y que el cliente puede seleccionar por capas cual mostrar o no"
- `L2` — "la cfg del selector se va apoder cambiar desde el back sin tener que compilar?"
- `L3` — The independent verifier found that serving `map.layers` would break every already published build: their strict `MapConfigSchema` rejects the whole `map` object over the extra key, so the client would lose its renderer, its region catalog and its download policy. Decision: the API route strips `layers` from the wire until the installed base carries the tolerant schema.
- `L4` — The wire gate on `map.layers` stays until the implementation is complete: `apps/api/src/routes/config.ts` keeps stripping the field while `T4`/`T5` are outstanding. The project is in active development, so the gate is lifted in the same release that ships the control — an already published build never receives a field it cannot parse, and the release that does receive it is the release whose UI can use it.
- `L5` — The native renderer is declarative, so the adapter is a pure transform of the style rather than `setLayoutProperty`. `experience-map.tsx` builds a whole `StyleSpecification` and hands it to `<MapLibreMap mapStyle={…}>`, and the style is rebuilt when its inputs change; there is no imperative map handle to poke at, and that is deliberate. The plan's wording (`setLayoutProperty` per layer the group owns) assumed the imperative MapLibre GL JS API, which is not what runs on the device. The transformation therefore lives in shared as `applyLayerGroups`, which is also what makes it testable without a map: hiding a group is a style the function returns, not a call recorded on a double. The web renderer (`experience-map.web.tsx`, MapLibre GL JS by way of `maplibre-gl`) can reuse the same function when it grows a control: its style is applied the same way (`applyMapDocuments` reconciles over a style object), so the transform it needs is the one that already exists.
- `L6` — Two corrections after `T4` came back. The first implementation satisfied itself by subscribing the renderer to `useRemoteConfigStore`, which contradicted the seam `use-map-view-config.ts` documents ("the map components take the source as their only input") and made every sibling suite depend on a store shape it should not know. The payload now rides on `MapSourceConfig.layers` and the renderer reads nothing else. The second was a duplicate: a rewritten version of the group test was added while the original store-driven one survived below it, so the file ran the same scenario twice and the stale copy failed. Removed, with the store import that only it used.
- `L7` — The selection moved up one level with `T5`. The switch (`experience-map-switch.tsx`) now owns it: it resolves the payload once with `resolveLayerSelection(source.layers ?? [], MAPLIBRE_LAYER_CAPABILITIES)`, keeps the result in state, flips one entry per toggle — raising `declared` with it, because a group the walker names is no longer a group the payload left silent — and hands the result to `ExperienceMap` as the `layerSelection` prop. The renderer no longer reads `source.layers` and no longer calls `resolveLayerSelection`: it applies what it is given, through the same pure `applyLayerGroups` transform as before. The prop is still an input by content (`selectionSignature`, next to `documentsKey`), so a caller that rebuilds the array on every render cannot rebuild the style and make native re-fetch its tiles. Two consequences worth recording: the renderer's former reading of the payload at every render is gone, so a payload that arrives after the map mounted no longer applies by itself (that is what persistence, `T7`, has to answer); and the control lives inside the MapLibre branch only, because the frozen Leaflet renderer can toggle no group.
- `L8` — The flag has a producer, so the control is reachable in the app and not only in tests. `useMapViewConfig` now returns `showLayersControl: map?.layers?.showControl` on the source, next to `layers`, from the same payload the hook already reads: the map components take the source as their only input, and whether the walker is offered the choice at all is a decision about what the map draws, exactly like the region and the group list. A payload that says nothing keeps it `undefined`, which the switch's `?? false` reads as off — the same "silence is not a request" rule the groups follow — and its suite pins the flag both ways (payload `true`, and payload absent or `false`). Nothing else changed: the switch, the control and the renderer are as `T5`/`L7` left them.
- `L9` — CodeRabbit's review on `#566` found three things the lenses and the refuter did not. Two were real: the **web renderer never read the selection**, so on web the control showed checkboxes that changed nothing (fixed with `applyLayerSelection` in `web-layer-visibility.ts`, and the signature both renderers now share moved to `layerSelectionSignature` in shared), and the Spanish accessibility label said `Caminos: oculta` — a fixed feminine adjective against masculine group names (now `Capa oculta: {{name}}` / `Capa visible: {{name}}`, with the English mirror). The third duplicated the refuter's late-payload finding, already fixed in `d3e3753`. Both renderers must land on the same picture, and only then is the control honest on both.
