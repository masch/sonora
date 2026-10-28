# Map Tiles: Our Fork Of The Protomaps Profile

The map publishes PMTiles built by us instead of a third-party archive, so it can show what OpenStreetMap shows: names on areas and buildings, and points of interest at z16. See [`docs/map-tiles.md`](../../docs/map-tiles.md) for what the published tiles carry today, and `odd/tasks/map-tiles-pipeline.md` for the plan this directory belongs to.

**The profile is not vendored.** Upstream (`protomaps/basemaps`, `tiles/`) stays the source of everything — layer schemas, tag mappings, label placement — and we carry three edits on top as patches. That keeps our fork a commit id plus a reviewable diff instead of a copy that drifts.

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
set -euo pipefail

# 1. the pinned upstream, shallow, at the exact commit
git clone https://github.com/protomaps/basemaps.git /tmp/basemaps-build
git -C /tmp/basemaps-build checkout 42ffaaa4a85a41bfcb23e43cc0f5b492a5eca123

# 2. our edits, in order. `set -e` above is what makes drift stop the build: the
#    first patch that no longer applies aborts here, before anything is compiled,
#    and `--check` fails without touching the tree.
for patch in scripts/map-tiles/patches/*.patch; do
  git -C /tmp/basemaps-build apply --check "$patch"
  git -C /tmp/basemaps-build apply "$patch"
done

# 3. the jar (JDK 21 + Maven; see docs/map-tiles.md for the toolchain)
cd /tmp/basemaps-build/tiles && mvn -B -q clean package -DskipTests
```

The result is `target/protomaps-basemap-*-with-deps.jar`: planetiler and the profile in one runnable jar.

## Measured on this fork

Against the `calamuchita` bbox at z16, with the auxiliary sources warm (issue #502 has the full comparison):

|                               | Size       | Build          | `name` on landuse/buildings | `pois`  |
| ----------------------------- | ---------- | -------------- | --------------------------- | ------- |
| Upstream profile              | 808 KB     | 18 min 37 s    | no                          | z15     |
| **This fork**                 | **824 KB** | **4 min 12 s** | **yes**                     | **z16** |
| What is published today (z15) | 846 KB     | —              | no                          | z15     |

## The failure mode this design has

When upstream moves, the recipe above stops at the first patch that no longer applies — `set -e` makes the loop abort and `--check` fails before the tree is touched — so a partially patched profile is never compiled. That is the point: the alternative — a vendored copy — drifts silently, and the map quietly stops gaining the fixes upstream ships. Re-pinning is deliberately a small, explicit act: change `upstream.json`, re-generate the patches, and let the build tell you whether they still mean what they meant.
