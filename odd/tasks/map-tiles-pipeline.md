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
- `T11` — draw the names the fork added (done: `landuse_label` in `assets/map/styles/v1.json` — the document's own natural-label template applied to `landuse`, any polygon with a non-empty `name`, from z13, in the `green` group by prefix, guarded by `basemap-style.test.ts` and published under the same version). Building names stay undrawn on purpose: `buildings` carries `name` since patch 0002, but its style layers are a fill plus `address_label` (z18 house numbers), and one label per footprint is noise in rural OSM. POIs at z16 needed nothing: the `pois` layer already admits every kind.
- `T9` — the two `osmdata` archives under our downloader (done: a `fetch-shapes` step fetches water and land polygons with `downloadVerified` before planetiler's own stage, so they resume across attempts and are verified as zips; planetiler finds them and skips them. The remaining sources stay with planetiler, small enough that a retry is cheaper than owning them): a real build proved that planetiler's own downloads **do not resume** — killing a stalled attempt discards its `.tmp`, so a slow-but-alive mirror can never finish 932 MB (three attempts lost 8 % each). The water and land polygons are the two artefacts big enough for that to matter, and `downloadVerified` resumes them (the same run resumed at 898 MB after two stalls). Until this is wired, a cold cache needs them pre-seeded by hand.
- `T10` — the upload targets validate their paths (done: `api-upload-map-tiles-*` runs wrangler from `apps/api`, so a path relative to the repository root used to fail **after** the archive was already uploaded — the first staging publish hit exactly this. Both paths are now resolved against the repository root and the target refuses to start when either file is missing):
- `T8` — web offline, a stage of its own: the browser keeps nothing today, on purpose — `canKeepMapArchive()` answers `false` there because `expo-file-system` is an unsupported stub and the archive is fetched whole since the API route publishes no `Range`. Staging it is cheap only while five seams hold: the capability stays the client's question and never a payload flag (the `#569` lesson); `archiveIdentity`, `isArchiveCurrent` and `MAP_ARTIFACT_VERSION` key both surfaces; the budget stays a policy input a second surface extends additively, since Cache Storage quota is per origin and shared with the PWA; fonts and sprite are published as immutable versioned artifacts from `T4` on even though only the device reads them; and the web adapter (whole file in memory) never becomes the contract the device inherits. Its acceptance is its own — a service worker installed and a reload in airplane mode drawing the base map with names and icons — never folded into `T6`, which verifies a device.

## Risks

- **Mirrors.** The whole build depends on `osmdata.openstreetmap.de`, S3 and Natural Earth — one of them hung for hours in the spike. `T3` exists because of that.
- **Build machine.** JDK 21 plus Maven plus 4–8 GB RAM is not "a script anyone runs"; decide who runs it before the first production upload.
- **A profile we now own.** The fork is three edits today; upstream changes will need re-applying. Pinning the commit is what keeps that honest.
- **What it still will not show**: `landcover` (z0–7 by design) and `boundaries` names, and nothing above z16.
- **Extract freshness.** A cached extract is kept, not refreshed: Geofabrik publishes a new `<area>-latest.osm.pbf` every day, and a build that silently moved to newer data would not be reproducible. Taking a newer one is a deliberate act — delete the file and the next run downloads and verifies it again.

## Delivery

The branch grew past one reviewable slice (15 commits, ~3 000 authored lines), so it is delivered
as three chained PRs. The history is already linear and the slices are contiguous prefixes, so the
split is three branch pointers — no rebase, no rewritten commit:

| Slice                                      | Branch                              | Base                    | Holds                                                                                                                                                                        | State                                                                                                                                                          |
| ------------------------------------------ | ----------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Verified downloads (`T3`)               | `feat/map-tiles-verified-downloads` | `main`                  | `download.ts` and its suite, the build wiring that fetches and verifies every source, the reset-abort test, the resume-validator correction                                  | **merged** as `#581` (`review-ee6c0efc0e395fc6`, burned)                                                                                                       |
| 2. A build that runs, and what it produced | `feat/map-tiles-build-tooling`      | slice 1                 | the pinned toolchain, the `.tools/` folder and cache default, the first real build's record, the operator runbook, `landuse_label`, and the five findings that review raised | **merged** as `#582` (`review-671fc942e9472290`, burned)                                                                                                       |
| 3. The gaps the real run exposed           | `feat/map-tiles-docs-and-labels`    | slice 2                 | `T9` (the two `osmdata` archives under our downloader), `T10` (upload paths resolved and checked), this delivery record                                                      | **merged** as `#583`                                                                                                                                           |
| 4. The render check, and what it found     | `feat/map-tiles-render-check`       | `main` (slice 3 merged) | the render check and its suite, `landuse_label`, patches `0005`–`0006`, the staging cache policy, and the four review findings `L11` records                                 | **merged** as `#584`. Past one slice — 14 commits, ~1223 authored lines — and merged whole, with each pair of commits reviewed natively and its receipt burned |

Each PR shows only its own increment, because its base is the previous slice. Publishing them —
push, `gh pr create --base <previous branch>`, merge order — is the human's decision; the
repository is not pushed from here.

## Log

- `L1` — "que es lo que tenemos que hacer para que se vea todo lo de OSM? evaluamos. no importa si es mucho el cambio"
- `L2` — The measurements that produced this plan live in issue #502: three spikes (OpenMapTiles profile, Protomaps profile, forked Protomaps profile) over the Argentina extract at the Calamuchita bbox, each with size, build time and the resulting `vector_layers`.
- `L3` — "documentar el resultado y armar plan de adopción": this document is the plan; the results are the issue comments it links.
- `L4` — "Seguimos con map-tiles-pipeline. Leé odd/tasks/map-tiles-pipeline.md hasta ## Log y scripts/map-tiles/README.md. Arrancamos por T3, y en la misma unidad va el test del aborto cuando falla el reset que dejó pendiente el validador."
- `L5` — T3 found two ways the entry point from `T2` lied, both about where a build's data comes from. `--data-dir` is not a planetiler 0.10 argument, so the auxiliary sources landed in `<checkout>/tiles/target/data/sources` and the next run's `clean -fdx` deleted the 1.4 GB the cache was supposed to keep; and the profile's own `--area` default is **monaco**, so a run that named no extract downloaded Monaco and reported it as the region's archive. The build now fetches the region's Geofabrik extract itself, runs the tiler in `<cache>/planetiler` (where planetiler resolves `data/sources`), and verifies every file there before the tiler reads it. The validator's pending abort is pinned in the suite: a failed reset ends the run at `reset-checkout`, with no patch applied, no jar built and no java spawned, and the dirty checkout left as it was.
- `L7` — T4 ran the pipeline for real, and the plan's numbers held: the archive is **843 052 B** at z16 with `landuse` (z2–15), `buildings` (z14–16) and `pois` (z7–16) all carrying `name`, against 846 213 B published today at z15 with no names — smaller, and with what OSM shows. The run also paid for itself in evidence: `osmdata.openstreetmap.de` stalled twice at 259 MB-scale and then refused connections, which is what `T3`'s speed guard and resume exist for (water 932 MB verified, land resumed from 129 MB and again from 898 MB). Two gaps surfaced and became `T9` and `T10`.
- `L10` — The web renderer showed fewer labels than the phone, and the difference was the zoom: the walker was at z14, where `Area.filterArea` still deleted names. The decision taken — **show everything, size second** — moved the gate from the data to the style: patch `0006` removes the name-stripping from `Area.java`, so names travel at every zoom (z13 now places `Bosque Umepay`, z14 and up place both) and `landuse_label`'s `minzoom` is the only thing deciding when one is drawn. Measured: **880 899 B**, +10 882 B over 870 017 and +37 847 B (+4.5%) over the 843 052 baseline. The expectations now include the z13 and z14 tiles, so the zoom that failed is the zoom the check asserts.
- `L9` — The walker compared the same place with OSM and found two more blanks, with two different causes. The big yellow area is `natural=heath`, and the profile's `natural` list never included it, so it was dropped before any style could see it — patch `0005` adds the tag. The grey one is `natural=bare_rock`, which _was_ in the tiles and had no fill layer in the style — `landuse_bare_rock` (and `landuse_heath`) fix that, in the `green` group by prefix. Measured: **870 017 B**, +10 752 B over patch `0004` and +26 965 B (+3.2%) over the 843 052 baseline. The render check now asserts fills as well as labels, from the committed expectations, so a blank area fails there instead of on a phone.
- `L8` — The device found the ceiling the plan only predicted: the area name appeared at z15 and vanished one zoom in. Two causes, both upstream. `landuse` stopped at z15, and `Landuse.postProcess` returns early **only** at `zoom == 15` and otherwise runs `Area.filterArea`, which strips `name`/`name:*` whenever `minArea < 117.19` — which it always is (400/256 = 1.56). Patch `0004` carries both lines, `setZoomRange(2, 16)` and `zoom >= 15`, and the rebuild measured the cost: **859 265 B**, +16 213 B (+1.9%) over 843 052. The render check asserts it at z16 (`--tile=16/20982/38967`), so the next person sees the label disappear in CI instead of on a phone.
- `L6` — "podriamos hacerlo en etapas el offline en web? puede ser para otra y ahora nos concentramos en mobile o seria mucho retrabajo hacerlo en etapas?" — Decided: mobile now (`T4`–`T7`), web offline as its own task (`T8`). The evidence for "staged, not rework": `canKeepMapArchive()` is the only `Platform.OS` in the download path and is documented as the seam a web storage plugs into; `map.download` in `@sonora/shared` carries no platform field; `glyphs.ts` already models font and sprite downloads; and the one genuinely web-specific constraint — the archive route answers `200` with the whole object, no `Range` — is backend plus a web adapter, not a device decision. The five conditions in `T8` are what keeps it that way.
- `L11` — Review left four findings on `#584`, and three of them were about the render check telling the truth about itself. The local server inherited `Bun.serve`'s default address — a runtime decision, not ours — so it now names `127.0.0.1` and a test pins it; the browser launch moved inside the `try` with `browser?.close()`, so a machine without a browser no longer leaves a socket listening; the CLI reports a bad flag as one line instead of the runtime's rejection dump, which is what `make … ARCHIVE=` used to produce; and the selector assertion no longer hides and queries the same hand-built list — the hidden set comes from `layerIdsForGroup`, the resolution the web control runs, and a group that claims no layer now fails the check. The docs stopped promising a z15 ceiling that patches `0004` and `0006` removed. Verified: `bun test scripts/map-tiles` 87 pass and the four render tiles skip (no built archive on this machine), `tsc -p scripts/tsconfig.json` clean, and the socket was observed on `127.0.0.1` during a run.
- `L12` — The four slices are merged (`#581`–`#584`), and the one thing the plan left open was who runs the
  render. Decision, and it reframed what the check is for: the integration test asserts the objects this
  project **knows** in one zone — the area names, and the heath and bare-rock areas OSM draws and this map
  left blank — so the archive it must test is the one the API **serves**, not a pinned copy. That turns
  staging's habit of being republished in place from a nuisance into the assertion: a publish that loses
  those objects is what goes red. `.github/workflows/ci-map-tiles.yml` resolves
  `DEFAULT_MAP_ARTIFACT_VERSION`, fetches `tiles/<region>/<version>.pmtiles` from the serving origin,
  refuses anything that is not a PMTiles archive of a plausible size, and runs `bun test scripts/map-tiles`
  with `MAP_TILES_ARCHIVE`; daily, on `main` when the style or the scripts change, on pull requests touching
  either, and on demand for staging or production. Measured before writing it: the staged `v1` archive
  (880 899 B) rendered with the repository's style places `Bosque Umepay` and `Huerta Madre` and paints
  `landuse_park`, `landuse_heath` and `landuse_bare_rock` at z13–z16 — 9 tests, 0 failures, 7.5 s with
  `CI=true`, so the job costs a download and a browser, not a build.
