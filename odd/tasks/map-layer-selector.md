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
- `T3` — group vocabulary and the capability contract: which groups each renderer can actually draw.
- `T4` — MapLibre selector UI.
- `T5` — decide the renderer default.

## Log

- `L1` — "lo que quisera, sin importar lo que hay hoy, es que se muestre todo lo que se ve en OSM en maplibre y que el cliente puede seleccionar por capas cual mostrar o no"
- `L2` — "la cfg del selector se va apoder cambiar desde el back sin tener que compilar?"
- `L3` — The independent verifier found that serving `map.layers` would break every already published build: their strict `MapConfigSchema` rejects the whole `map` object over the extra key, so the client would lose its renderer, its region catalog and its download policy. Decision: the API route strips `layers` from the wire until the installed base carries the tolerant schema.
