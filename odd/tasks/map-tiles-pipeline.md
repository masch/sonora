# Feature: Own Map Tiles

**Feature ID:** `map-tiles-pipeline`
**Status:** in progress — `T1`–`T3` are built on `feat/map-tiles-verified-downloads` and reviewed; `T4` published a real archive to **staging** (`v1`, in place) and it is verified byte-identical over HTTP; `T5`–`T8` are still a plan. Three spikes measured the cost (issue #502). The decision this plan serves: replace the third-party archive with one we build, so the map can show what OpenStreetMap shows.

## Specs

**S1 — Show what OSM shows, whatever it costs**

> "que es lo que tenemos que hacer para que se vea todo lo de OSM? evaluamos. no importa si es mucho el cambio"

**S2 — Staging may break compatibility in place, without a new version**

> "mencionas que importa la version actual de staging, esa no importa, podmos romper compatibilidad actulizando la actual sin crear una version nueva"

**S3 — Keep the reasoning in the repository, not in a session**

> "podemos dejarlo documentado en el readme todo esto para recordara futuro"

## What the spikes established

Measured on the `calamuchita` bbox (issue #502, three comments):

- The published archive carries **no `name`** on `landuse`, `landcover`, `buildings` or `boundaries`, and stops at **z15**; the POIs OSM shows at high zoom are emitted by Protomaps at z15 at the earliest.
- A self-built tileset with the **Protomaps profile** keeps our schema (`kind`/`kind_detail`, `roads`/`pois`/`places`) → **no style rewrite**, 808 KB at z16, ~18 min per region cold, ~4 min warm.
- A **three-edit fork** of that profile adds `name` to `landuse` and `buildings` and takes `pois` to z16, for **+16 KB**: 824 KB total, 22 KB less than today's archive.
- The build needs **JDK 21 + Maven**, ~1.4 GB of cached auxiliary sources, and 4–8 GB of RAM per run.

## Tasks

- `T1` — vendor the fork, not a fork of the fork: pin the upstream `protomaps/basemaps` commit and carry the three edits as patches in the repository (`scripts/map-tiles/patches/`), so the profile's provenance is a commit id plus a reviewable diff.
- `T2` — one build entry point: a Make target that clones the pinned commit, applies the patches, builds the profile jar and runs the tiler for one region, with the sources cache as an explicit directory argument (done on `feat/map-tiles-build`; `make map-tiles-build REGION=<region>`, planned and tested in `scripts/map-tiles/build.ts` and `scripts/map-tiles/__tests__/build.test.ts`).
- `T3` — downloads that cannot lie: every fetched artefact is verified before use (speed guard plus resume for mirrors that stall without closing, zip/JAR integrity check, and a size check where the server publishes one). Three truncated downloads and one 9h46m stall already happened without it (done on `feat/map-tiles-verified-downloads`: `0294341` the verified downloader, `563eccf` the build wiring and the reset-abort test; this record follows in the same unit).
- `T4` — publish: upload the archive and the style with the existing `api-upload-map-tiles-*` targets, bumping `MAP_ARTIFACT_VERSION` per environment (staging first, per `S2`). Staging done: `tiles/calamuchita/v1.pmtiles` (843 052 B) and `styles/v1.json` under the existing `v1`, and the served archive is byte-identical to the built one (same sha256, `PMTiles` magic, `no-cache` as `#573` requires); the style is served rewritten to the staging origin for glyphs and sprite. Production still withholds it.
- `T5` — offline budget: confirm `map.download.autoMaxBytes` (8 MB) and `cacheMaxBytes` (100 MB) still fit the new archive and the regions we intend to publish — the built archive measured **843 052 B** (824 KB), below what is published today, so the budgets hold for this region and this task is the check, not the change. Measured against the device while the browser keeps nothing; if `#571` decides the browser stores a map, this covers both surfaces before `T8` starts.
- `T6` — device reading: a trip and a track at Calamuchita show area names and the POIs that were missing, base map and labels draw offline, and the layer selector still claims every layer of the new style.
- `T7` — documents: `docs/map-tiles.md` gets the results and an operator runbook; the README keeps pointing at it (`S3`).
- `T11` — draw the names the fork added (done: `landuse_label` in `assets/map/styles/v1.json`, the document's own natural-label template applied to `landuse` — any polygon with a non-empty `name`, from z13, in the `green` group by prefix; buildings stay undrawn on purpose): the archive now carries `name` on `landuse` and `buildings`, but the style has no layer that draws them — its eleven `landuse` layers are fills and `buildings` is a fill plus `address_label` (z18 house numbers). Adding the symbol layers to `assets/map/styles/v1.json` (guarded by `basemap-style.test.ts`, published under the same version) is what turns "the name is in the tiles" into "the name is on the map", and it is a prerequisite for the area-name half of `T6`. POIs at z16 need nothing: the `pois` layer already admits every kind.
- `T9` — the two `osmdata` archives under our downloader: a real build proved that planetiler's own downloads **do not resume** — killing a stalled attempt discards its `.tmp`, so a slow-but-alive mirror can never finish 932 MB (three attempts lost 8 % each). The water and land polygons are the two artefacts big enough for that to matter, and `downloadVerified` resumes them (the same run resumed at 898 MB after two stalls). Until this is wired, a cold cache needs them pre-seeded by hand.
- `T10` — the upload targets validate their paths: `api-upload-map-tiles-*` runs wrangler from `apps/api`, so a `STYLE=` path relative to the repository root fails **after** the archive is already uploaded, leaving the bucket half-updated. The first staging publish hit exactly this.
- `T8` — web offline, a stage of its own: the browser keeps nothing today, on purpose — `canKeepMapArchive()` answers `false` there because `expo-file-system` is an unsupported stub and the archive is fetched whole since the API route publishes no `Range`. Staging it is cheap only while five seams hold: the capability stays the client's question and never a payload flag (the `#569` lesson); `archiveIdentity`, `isArchiveCurrent` and `MAP_ARTIFACT_VERSION` key both surfaces; the budget stays a policy input a second surface extends additively, since Cache Storage quota is per origin and shared with the PWA; fonts and sprite are published as immutable versioned artifacts from `T4` on even though only the device reads them; and the web adapter (whole file in memory) never becomes the contract the device inherits. Its acceptance is its own — a service worker installed and a reload in airplane mode drawing the base map with names and icons — never folded into `T6`, which verifies a device.

## Risks

- **Mirrors.** The whole build depends on `osmdata.openstreetmap.de`, S3 and Natural Earth — one of them hung for hours in the spike. `T3` exists because of that.
- **Build machine.** JDK 21 plus Maven plus 4–8 GB RAM is not "a script anyone runs"; decide who runs it before the first production upload.
- **A profile we now own.** The fork is three edits today; upstream changes will need re-applying. Pinning the commit is what keeps that honest.
- **What it still will not show**: `landcover` (z0–7 by design) and `boundaries` names, and nothing above z16.
- **Extract freshness.** A cached extract is kept, not refreshed: Geofabrik publishes a new `<area>-latest.osm.pbf` every day, and a build that silently moved to newer data would not be reproducible. Taking a newer one is a deliberate act — delete the file and the next run downloads and verifies it again.

## Log

- `L1` — "que es lo que tenemos que hacer para que se vea todo lo de OSM? evaluamos. no importa si es mucho el cambio"
- `L2` — The measurements that produced this plan live in issue #502: three spikes (OpenMapTiles profile, Protomaps profile, forked Protomaps profile) over the Argentina extract at the Calamuchita bbox, each with size, build time and the resulting `vector_layers`.
- `L3` — "documentar el resultado y armar plan de adopción": this document is the plan; the results are the issue comments it links.
- `L4` — "Seguimos con map-tiles-pipeline. Leé odd/tasks/map-tiles-pipeline.md hasta ## Log y scripts/map-tiles/README.md. Arrancamos por T3, y en la misma unidad va el test del aborto cuando falla el reset que dejó pendiente el validador."
- `L5` — T3 found two ways the entry point from `T2` lied, both about where a build's data comes from. `--data-dir` is not a planetiler 0.10 argument, so the auxiliary sources landed in `<checkout>/tiles/target/data/sources` and the next run's `clean -fdx` deleted the 1.4 GB the cache was supposed to keep; and the profile's own `--area` default is **monaco**, so a run that named no extract downloaded Monaco and reported it as the region's archive. The build now fetches the region's Geofabrik extract itself, runs the tiler in `<cache>/planetiler` (where planetiler resolves `data/sources`), and verifies every file there before the tiler reads it. The validator's pending abort is pinned in the suite: a failed reset ends the run at `reset-checkout`, with no patch applied, no jar built and no java spawned, and the dirty checkout left as it was.
- `L7` — T4 ran the pipeline for real, and the plan's numbers held: the archive is **843 052 B** at z16 with `landuse` (z2–15), `buildings` (z14–16) and `pois` (z7–16) all carrying `name`, against 846 213 B published today at z15 with no names — smaller, and with what OSM shows. The run also paid for itself in evidence: `osmdata.openstreetmap.de` stalled twice at 259 MB-scale and then refused connections, which is what `T3`'s speed guard and resume exist for (water 932 MB verified, land resumed from 129 MB and again from 898 MB). Two gaps surfaced and became `T9` and `T10`.
- `L6` — "podriamos hacerlo en etapas el offline en web? puede ser para otra y ahora nos concentramos en mobile o seria mucho retrabajo hacerlo en etapas?" — Decided: mobile now (`T4`–`T7`), web offline as its own task (`T8`). The evidence for "staged, not rework": `canKeepMapArchive()` is the only `Platform.OS` in the download path and is documented as the seam a web storage plugs into; `map.download` in `@sonora/shared` carries no platform field; `glyphs.ts` already models font and sprite downloads; and the one genuinely web-specific constraint — the archive route answers `200` with the whole object, no `Range` — is backend plus a web adapter, not a device decision. The five conditions in `T8` are what keeps it that way.
