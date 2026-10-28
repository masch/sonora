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
make map-tiles-build REGION=calamuchita
```

Optional: `MAXZOOM` (default 16, the deepest zoom the profile emits) and `CACHE` (default a directory under the OS temp, printed by the script). The archive lands at `<CACHE>/out/<region>.pmtiles`; publish it with `make api-upload-map-tiles-staging REGION=… VERSION=… ARCHIVE=… STYLE=…`.

The script — [`build.ts`](./build.ts) — does what the prose recipe here used to ask a human to paste: it reads `upstream.json`, checks out that commit (or reuses a checkout already on it), applies `patches/*.patch` in filename order with absolute paths, builds `target/protomaps-basemap-*-with-deps.jar`, runs the tiler, and reports. Every step runs through one executor, so the first failure ends the run naming the step; there is no `set -euo pipefail` to remember. It also refuses to start without JDK 21 and Maven, in one sentence that says what is missing and where it looked.

On success it prints the output path, its size in bytes, how long the tile step took, and the archive's `vector_layers` ids. If `landuse`, `buildings` or `pois` is absent it warns, naming the patch that should have added it.

### Where the cache lives, and why to keep it

The cache is the checkout plus the auxiliary sources the tiler downloads — ~1.4 GB. It defaults to `$TMPDIR/sonora-map-tiles` and the script prints it at the start and end of every run. That is the directory worth keeping: with it warm a region builds in ~4 minutes, and cold it adds ~18 minutes of downloading. Pass `CACHE=/var/tmp/sonora-map-tiles` (or anywhere outside the OS temp cleaner) to make that explicit. The archive is written to `<cache>/out/<region>.pmtiles` for the same reason: the same directory can be handed to the upload targets.

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
