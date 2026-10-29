# Map Tiles: Our Fork Of The Protomaps Profile

The map publishes PMTiles built by us instead of a third-party archive, so it can show what OpenStreetMap shows: names on areas and buildings, and points of interest at z16. See [`docs/map-tiles.md`](../../docs/map-tiles.md) for what the published tiles carry today, and `odd/tasks/map-tiles-pipeline.md` for the plan this directory belongs to.

**The profile is not vendored.** Upstream (`protomaps/basemaps`, `tiles/`) stays the source of everything — layer schemas, tag mappings, label placement — and we carry three edits on top as patches. That keeps our fork a commit id plus a reviewable diff instead of a copy that drifts.

## Why patches, and not one of the other three ways

Our whole delta is three lines in three Java files. Everything below is about carrying that tiny change over somebody else's project without taking the project over.

| Option                                                                                                                       | What it would mean                              | Why it lost                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor the project** — copy `tiles/` into this repository                                                                  | we own hundreds of Java files and a Maven build | upstream fixes stop arriving unless someone merges them by hand, and nobody will                                                                                       |
| **Fork the repository on GitHub** — our own copy with the three lines                                                        | a second repository to keep in sync             | the delta leaves our review: reading a change to the map would mean visiting another repository, and its history is not this one                                       |
| **Overlay the three files** — keep full copies of `Landuse.java`, `Buildings.java`, `Pois.java` and copy them over the clone | the whole file, easy to read                    | a copy **overwrites without asking**: if upstream edits that file, the copy wins and the conflict is never seen. Silent drift, the failure this design exists to avoid |
| **Patches** — the three diffs, applied to a pinned clone                                                                     | a commit id plus a diff                         | it is the only option that **notices** upstream changing, because a patch that no longer applies stops the build                                                       |

The patches are a build input, nothing more. No application code reads them, they never travel to a device: they exist so whoever builds the tiles gets exactly the profile that was measured. If one fails, the answer is to read the upstream change and re-generate the patch — never to force it.

| Piece                  | Where                                        |
| ---------------------- | -------------------------------------------- |
| Pinned upstream commit | `upstream.json`                              |
| Our edits              | `patches/*.patch`, applied in filename order |

## The three edits, and why each exists

| Patch                         | Change                                                        | Why                                                                                          |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `0001-landuse-keeps-its-name` | `name` is kept on the `landuse` polygon emission              | upstream drops it for size, which is why a forest, a meadow or an orchard cannot be labelled |
| `0002-buildings-name-and-z16` | `name` is kept on buildings, and the layer reaches z16        | same reason, plus the ceiling that hid the detail OSM draws at high zoom                     |
| `0003-pois-reaches-z16`       | points of interest are emitted up to z16, both emission sites | the toilets, cabins and viewpoints of OSM appear at z16, and upstream stops at z15           |

`landcover` is deliberately untouched: its features live at z0–7, where an area name buys nothing. What matters for a forest is `landuse=wood`, covered by patch 1.

## Building it

```bash
make map-tiles-toolchain      # once: pinned JDK 21 + Maven, outside the repo
make map-tiles-build REGION=calamuchita
```

The profile compiles with `maven.compiler.source=21`, so JDK 17 is not enough. `make map-tiles-toolchain` installs the pinned **JDK 21.0.13+9** (Adoptium) and **Maven 3.9.16** (Apache) into **`<repo>/.tools/toolchain`**: one folder inside the checkout, ignored by `.gitignore`, so nothing of the build's own lives outside the project and no binary ever enters git. Both archives are checked against the digest the vendor publishes before they are unpacked, and a stamped installation is reused; `--root`, `TOOLCHAIN=` or `SONORA_TOOLCHAIN` moves it, and a root inside the repository but outside `.tools/` is refused. `make map-tiles-build` picks that toolchain up when it is installed and falls back to whatever `java` and `mvn` are on `PATH` when it is not.

Optional: `MAXZOOM` (default 16, the deepest zoom the profile emits) and `CACHE` (default `<repo>/.tools/cache`, printed by the script). The archive lands at `<CACHE>/out/<region>.pmtiles`; publish it with `make api-upload-map-tiles-staging REGION=… VERSION=… ARCHIVE=… STYLE=…`.

The script — [`build.ts`](./build.ts) — does what the prose recipe here used to ask a human to paste: it reads `upstream.json`, checks out that commit (or reuses a checkout already on it), returns the checkout to that commit, applies `patches/*.patch` in filename order with absolute paths, builds `target/protomaps-basemap-*-with-deps.jar`, downloads the region's extract and the tiler's own auxiliary sources, verifies every one of them, runs the tiler, and reports. Every step runs through one executor, so the first failure ends the run naming the step; there is no `set -euo pipefail` to remember. It also refuses to start without JDK 21 and Maven, in one sentence that says what is missing and where it looked.

The extract is chosen by the script, not by the profile: `MAP_TILE_EXTRACTS` in `build.ts` maps each region to its Geofabrik area (`calamuchita` → `south-america/argentina`). The profile's own `--area` default is **monaco**, so a build that names no extract tiles Monaco and reports it as this region's archive — the first version of this script did exactly that, and a region without an entry in the table is now refused before anything runs.

On success it prints the output path, its size in bytes, how long the tile step took, and the archive's `vector_layers` ids. If `landuse`, `buildings` or `pois` is absent it warns, naming the patch that should have added it.

### Downloads that cannot lie

The spikes lost three downloads and one afternoon to the mirrors: three truncated files, and one attempt that stalled at 259 MB with the connection still open for 9 h 46 min. So nothing this run fetches is trusted before it is checked, in ["download.ts"](./download.ts):

| Rule            | What it does                                                                                                                                                                           | What it caught                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Resume**      | a partial transfer lives in `<file>.part` and the next attempt asks for `Range: bytes=<size>-`; a server that ignores the range restarts the file instead of gluing two heads together | interrupted 450 MB extract downloads                                                            |
| **Speed guard** | an attempt that delivers under 64 KB/s for 30 s is stopped and retried, and a source download that keeps delivering nothing for 120 s is killed and retried, three times               | the 9 h 46 min stall                                                                            |
| **Size**        | when the server publishes a total, the finished file has exactly that many bytes                                                                                                       | three truncated downloads                                                                       |
| **Integrity**   | the zip's central directory, the extract's OSM PBF header, a gzip's magic bytes, and a JAR's `META-INF/MANIFEST.MF`, all read before the tiler sees the file                           | a 9-byte `Not Found` saved as `planetiler.jar`, a 931 MB water-polygons zip that would not open |

A download stage is `fetch-osm` (the extract, ours), then `fetch-shapes` (the two ~950 MB `osmdata` archives — water and land polygons — which planetiler's own downloader cannot finish, because it does not resume and a stalled mirror costs the whole attempt), then `download-sources` (planetiler's remaining sources: Natural Earth, the landcover file, qrank, fonts) and `verify-sources`, which opens every file before the tiler reads any of them.

A finished file is only renamed into place after it passes, and a file that no longer passes is discarded and fetched again. A partial is only resumed against the validator it was fetched with (`If-Range`), so an interrupted download continues but yesterday's bytes are never glued to today's file.

A cached extract is kept rather than refreshed: Geofabrik publishes a new `<area>-latest.osm.pbf` every day, and a build that silently moved to newer data would not be reproducible. Delete `<cache>/planetiler/data/sources/<area>.osm.pbf` when you mean to take a newer one — the next run downloads and verifies it again.

### Where the cache lives, and why to keep it

The cache is the checkout, the auxiliary sources the tiler downloads and the archive — ~2.9 GB plus the region's extract. It defaults to **`<repo>/.tools/cache`**, the same ignored folder the toolchain lives in, and the script prints it at the start and end of every run. That is the directory worth keeping: with it warm a region builds in ~4 minutes, and cold it adds ~18 minutes of downloading. Pass `CACHE=/var/tmp/sonora-map-tiles` (or anywhere outside the OS temp cleaner) to make that explicit. The archive is written to `<cache>/out/<region>.pmtiles` for the same reason: the same directory can be handed to the upload targets.

```
.tools/                      the one folder .gitignore holds; nothing of this lives outside it
.tools/toolchain/            JDK 21 + Maven, installed once
.tools/cache/                everything a run downloads and writes
  basemaps/                  the pinned checkout, patched by the run and cleaned by the next one
  planetiler/                the tiler's working directory
    data/sources/            the extract and every auxiliary source, verified before use
  out/<region>.pmtiles       the archive
```

The tiler runs **inside `<cache>/planetiler`**, and planetiler resolves its own `data/sources` against its working directory. That is why the sources are not in the checkout: a run leaves its patches applied as uncommitted changes, so before patching it returns the checkout to the pinned commit (`git reset --hard` and `git clean -fdx` inside `<cache>/basemaps`), and anything kept there would be deleted. The tiler's working directory is a sibling, so it survives that reset, and a warm cache builds what the first run did instead of stopping at a patch it already finds applied or downloading 2.9 GB again.

### When a patch stops the build

A patch that no longer applies ends the run at that patch, before the jar is built, so a half-patched profile is never compiled. Read the upstream change at the pinned commit, re-generate the patch against the new tree, and run the command again. Never force it — not with `--3way`, not by editing the checkout by hand: the patch is the only thing that notices upstream moving, and forcing it is how silent drift comes back.

## Measured on this fork

Against the `calamuchita` bbox at z16, with the auxiliary sources warm (issue #502 has the full comparison):

|                               | Size       | Build          | `name` on landuse/buildings | `pois`  |
| ----------------------------- | ---------- | -------------- | --------------------------- | ------- |
| Upstream profile              | 808 KB     | 18 min 37 s    | no                          | z15     |
| **This fork**                 | **824 KB** | **4 min 12 s** | **yes**                     | **z16** |
| What is published today (z15) | 846 KB     | —              | no                          | z15     |

## The failure mode this design has

When upstream moves, the build stops at the first patch that no longer applies — the run aborts there, before the jar is built — so a partially patched profile is never compiled. That is the point: the alternative — a vendored copy — drifts silently, and the map quietly stops gaining the fixes upstream ships. Re-pinning is deliberately a small, explicit act: change `upstream.json`, re-generate the patches, and let the build tell you whether they still mean what they meant.
