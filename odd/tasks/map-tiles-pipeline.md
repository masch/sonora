# Feature: Own Map Tiles

**Feature ID:** `map-tiles-pipeline`
**Status:** plan only — three spikes measured the cost (issue #502), nothing is built. The decision this plan serves: replace the third-party archive with one we build, so the map can show what OpenStreetMap shows.

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
- `T3` — downloads that cannot lie: every fetched artefact is verified before use (speed guard plus resume for mirrors that stall without closing, zip/JAR integrity check, and a size check where the server publishes one). Three truncated downloads and one 9h46m stall already happened without it.
- `T4` — publish: upload the archive and the style with the existing `api-upload-map-tiles-*` targets, bumping `MAP_ARTIFACT_VERSION` per environment (staging first, per `S2`).
- `T5` — offline budget: confirm `map.download.autoMaxBytes` (8 MB) and `cacheMaxBytes` (100 MB) still fit the new archive and the regions we intend to publish — the measured 824 KB says they do, and this task is the check, not the change.
- `T6` — device reading: a trip and a track at Calamuchita show area names and the POIs that were missing, base map and labels draw offline, and the layer selector still claims every layer of the new style.
- `T7` — documents: `docs/map-tiles.md` gets the results and an operator runbook; the README keeps pointing at it (`S3`).

## Risks

- **Mirrors.** The whole build depends on `osmdata.openstreetmap.de`, S3 and Natural Earth — one of them hung for hours in the spike. `T3` exists because of that.
- **Build machine.** JDK 21 plus Maven plus 4–8 GB RAM is not "a script anyone runs"; decide who runs it before the first production upload.
- **A profile we now own.** The fork is three edits today; upstream changes will need re-applying. Pinning the commit is what keeps that honest.
- **What it still will not show**: `landcover` (z0–7 by design) and `boundaries` names, and nothing above z16.

## Log

- `L1` — "que es lo que tenemos que hacer para que se vea todo lo de OSM? evaluamos. no importa si es mucho el cambio"
- `L2` — The measurements that produced this plan live in issue #502: three spikes (OpenMapTiles profile, Protomaps profile, forked Protomaps profile) over the Argentina extract at the Calamuchita bbox, each with size, build time and the resulting `vector_layers`.
- `L3` — "documentar el resultado y armar plan de adopción": this document is the plan; the results are the issue comments it links.
