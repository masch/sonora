# Map Tiles: What The Map Carries, And How To Build It

Operator and engineer reference for the base map. It records what was **measured** on the published artifacts and what the build actually produces, so neither the analysis nor the recipe has to be repeated. The map is now built here: the archive staging serves is made by this repository, from a pinned upstream profile plus three patches.

Companion page: [Map Assets Pipeline](map-assets-pipeline.md) covers how the style, glyphs and sprite reach a device.

---

## 1. Where the map comes from today

| Piece          | Value                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Renderer       | MapLibre (native and web), fed by `GET /config`                                                                                     |
| Style          | Protomaps light, 71 layers, served from our bucket and **rewritten in flight** (`glyphs`, `sprite`, `pmtiles://` origins)           |
| Tiles          | one PMTiles archive per region, `tiles/<region>/<version>.pmtiles`                                                                  |
| Archive served | `calamuchita/v1.pmtiles`, **843 052 bytes**, PMTiles v3, **z0–16**, built by [`scripts/map-tiles/`](../scripts/map-tiles/README.md) |
| Offline        | native keeps the archive on disk and reads `pmtiles://file://…`; the browser streams it over HTTP                                   |

The style document is repository source: `assets/map/styles/v1.json`, guarded by `packages/shared/src/__tests__/basemap-style.test.ts`.

## 2. What the archive actually carries

Read from the archive's own header and `vector_layers` metadata after a build, not assumed. Header: PMTiles v3, gzip internally, 1 544 addressed tiles / 1 191 entries, **z0–16**.

| Layer        | zooms     | has `name` | fields that matter                                       |
| ------------ | --------- | ---------- | -------------------------------------------------------- |
| `earth`      | 0–16      | yes        | kind, min_zoom, translated names                         |
| `landuse`    | 2–15      | **yes**    | kind, sort_rank, **name**                                |
| `landcover`  | 0–7       | no         | kind                                                     |
| `places`     | 1–15      | yes        | kind, **kind_detail**, min_zoom, population              |
| `pois`       | 7–**16**  | yes        | kind, **kind_detail**, min_zoom                          |
| `roads`      | 3–16      | yes        | kind, kind_detail, ref, **shield_text**, network, oneway |
| `water`      | 0–16      | yes        | kind, kind_detail, min_zoom                              |
| `buildings`  | 14–**16** | **yes**    | **name**, addr_housenumber, height, kind                 |
| `boundaries` | 6–16      | no         | kind, brk_a3, disputed                                   |

The three bold changes are ours, carried as patches on the pinned upstream commit (`0001` `name` on `landuse`, `0002` `name` on buildings and buildings to z16, `0003` `pois` to z16). Everything else is upstream.

## 3. What it still will not show

The fork closed the **data** gap: `landuse` and `buildings` now carry `name` and `pois` reaches z16. Only one of the three is drawn, and the difference matters:

- **POIs at z16 — visible now.** The style's `pois` symbol layer already admits every kind, so the toilets, cabins and viewpoints of z16 appear without touching the style.
- **Area names — drawn since `T11`.** `landuse_label` applies the document's own natural-label template (the one island and lake names use) to `landuse`: any polygon with a non-empty `name`, from z13, italic 10 px. It sits in the `green` group by prefix, so the selector can still hide it. The ceiling is the data's: `landuse` stops at z15, so the label stops there too.
- **Building names — in the tiles, not on the map.** `buildings` carries `name` since patch 0002, but its style layers are a fill plus `address_label` (z18, house numbers). Nothing draws the name yet, deliberately: named buildings in rural OSM are rare and one label per footprint is noise.
- **`landcover` names**: by design, its features live at z0–7 where an area name buys nothing. The forests that matter are `landuse=wood`, which does carry a name.
- **`boundaries` names**: upstream drops them, and the fork does not add them.
- **Anything above z16**: the profile stops there; addresses (`address_label`) ask for z18.
- **Browser offline**: the browser still keeps nothing, on purpose (`canKeepMapArchive()` answers `false` there). That is `T8` in the plan, staged separately.

The measurements below are kept as the record of why the old map looked the way it did — the first one is the gap `T11` closed:

1. **Area names cannot exist.** `landuse` has 11 layers in the style and **all of them are fills**; there is no symbol layer. And even if there were one, `landuse` carries no `name` field: "Bosque Umepay" or "Huerta Madre" are not in our tiles at all.
2. **The POI set is complete for what we carry.** The sprite has 53 icons; 34 are POI kinds and the style already admits every one of them. The apparent 35th, `train_station`, is the icon the already-admitted kind `station` resolves to. Nothing left to add without new data.
3. **Place granularity was never missing.** `places_locality` filters on `kind == "locality"`, and in this archive every village, hamlet and isolated dwelling _is_ exactly that — a finer `kind_detail` layer drew a second label on the same point, which is why it does not exist.

What OSM shows and we cannot, for the same reason — the data is not there:

- names on forests, meadows, orchards, farms, and on buildings;
- POIs at the zoom OSM shows them (z16+), and addresses (`address_label` asks for **z18**);
- one-way arrows and the rest of the z16 detail.

## 4. The options, honestly priced — and the one taken

**Taken: the middle path**, built and published. The table stays as the reasoning that chose it.

| Path                                                             | What it buys                                                              | Cost                                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Extend the style only**                                        | road shields on more classes, finer place labels, water and island labels | **Already exhausted** by the measurements above: nothing left that the data supports                                                     |
| **Own tile build** (planetiler or tilemaker, custom profile)     | the missing names, a full POI table, and z16–17 depth                     | a profile to own, a build to run per region, and a much larger archive — which changes the offline budget (`autoMaxBytes` is 8 MB today) |
| **Third-party vector basemap** (MapTiler, Stadia, OSM Americana) | a richer map fastest                                                      | a dependency, a bill, a usage policy, and the end of "our bucket, our offline"                                                           |

The middle path is the only one that closes the gap, and its cost is exactly what the spike below measures.

## 5. The spike, kept as the record of how this was priced

The spike below is what chose the path; the numbers in §6 are what the pipeline now produces. It stays so nobody has to re-derive the cost from scratch.

**Inputs**

| Piece   | Value                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Tiler   | Planetiler **v0.10.2** — `https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar` |
| Source  | Geofabrik `https://download.geofabrik.de/south-america/argentina-latest.osm.pbf`                             |
| Area    | the `calamuchita` bbox from `MAP_REGIONS`: `-64.83,-32.28,-64.66,-32.12`                                     |
| Depth   | `--maxzoom=16`                                                                                               |
| Runtime | **Java 21** (planiliter v0.10.2 is compiled for class file 65), `-Xmx8g`, scratch on tmpfs                   |

**Commands**

```bash
mkdir -p /tmp/tile-spike && cd /tmp/tile-spike

curl -sL -o planetiler.jar \
  https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar
curl -sL -C - -o argentina.osm.pbf \
  https://download.geofabrik.de/south-america/argentina-latest.osm.pbf

/usr/bin/time -f "elapsed=%E maxrss=%MkB" java -Xmx8g -jar planetiler.jar \
  --osm-path=argentina.osm.pbf \
  --bounds=-64.83,-32.28,-64.66,-32.12 \
  --maxzoom=16 \
  --output=calamuchita-z16.pmtiles \
  --force --download
```

**What to measure**, and how to read it:

1. output size against the current **846 213 bytes**;
2. elapsed build time;
3. whether the default profile keeps `name` on `landuse` / `buildings`, read from the output's `vector_layers`.

If (3) is negative, the size in (1) is a **floor** — a custom profile keeping rich content produces something larger, and that is the number a decision needs.

**Known limits.** Planetiler's default profile is not the Protomaps profile this map publishes, so equal depth does not mean equal content. The whole Argentina extract is parsed to emit one bbox: the time measured is dominated by parsing, and a real build would pay that once per published region.

**Gotchas, recorded the hard way.** The first attempt fetched `onthemart/planetiler` and silently wrote a **9-byte** jar containing `Not Found`. The project is `onthegomap/planetiler`. Always `ls -l` the download. The second attempt ran on **Java 17** and died in 0.13 s with `UnsupportedClassVersionError: class file version 65.0, this version only recognizes up to 61.0` — a Java 21 runtime is a hard requirement of the 0.10.x line, and a local JDK can be fetched without touching the system one:

```bash
curl -sL -o /tmp/tile-spike/jre21.tar.gz \
  "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse"
tar -xzf /tmp/tile-spike/jre21.tar.gz -C /tmp/tile-spike
export JAVA_HOME=/tmp/tile-spike/jdk-21*
"$JAVA_HOME/bin/java" -version
```

## 6. Running the pipeline

### Once per machine

```bash
make map-tiles-toolchain
```

Installs the pinned **JDK 21.0.13+9** (Adoptium) and **Maven 3.9.16** (Apache) into **`<repo>/.tools/toolchain`**, which `.gitignore` holds: the repository keeps the versions and digests, never the binaries, and a root inside the checkout but outside `.tools/` is refused. Each archive is checked against the digest the vendor publishes before it is unpacked, and a stamped installation is reused. `TOOLCHAIN=` / `SONORA_TOOLCHAIN` move it.

### Every build

```bash
make map-tiles-build REGION=calamuchita                  # cache in <repo>/.tools/cache
make map-tiles-build REGION=calamuchita CACHE=/var/tmp/sonora-map-tiles   # another disk
```

What a run does, in order, stopping at the first failure and naming it:

| Step               | What it guarantees                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync-upstream`    | the pinned commit is checked out, or the existing checkout is moved to it                                                                                       |
| `reset-checkout`   | the tree is **exactly** the pin, so patches always meet a clean tree (a failed reset ends the run)                                                              |
| `apply-patch`      | the three edits apply; a patch that no longer applies stops the build **before** the jar is compiled                                                            |
| `build-jar`        | the profile builds (`mvn -B -q clean package -DskipTests`)                                                                                                      |
| `fetch-osm`        | the region's Geofabrik extract, resumed, size-checked and verified as an OSM PBF                                                                                |
| `fetch-shapes`     | the two ~950 MB `osmdata` archives (water and land polygons), resumed and verified as zips — planetiler's own downloader does not resume, so these two are ours |
| `download-sources` | planetiler's own sources, under a stall guard (120 s without growth ⇒ kill and retry, 3 attempts)                                                               |
| `verify-sources`   | every file in the sources directory opens (zip central directory, PBF header, gzip magic, JAR manifest)                                                         |
| `run-tiler`        | the archive, from a jar whose `META-INF/MANIFEST.MF` was checked first                                                                                          |

Budget, measured: **~3.9 GB** in the cache (2.9 GB sources + 100 MB checkout/jar + temporaries), ~4.8 GB peak RAM with `-Xmx8g`. First run on a cold cache downloads ~3.9 GB; a warm run is **~5 minutes** (4 m 38 s for `calamuchita` at z16, of which 3 m 57 s is tiling).

### Publishing

```bash
make api-upload-map-tiles-staging REGION=calamuchita VERSION=v1 \
  ARCHIVE=/absolute/path/calamuchita.pmtiles \
  STYLE=/absolute/path/to/assets/map/styles/v1.json
```

- **Absolute paths.** The target runs wrangler from `apps/api`, so a repository-relative `STYLE=` fails _after_ the archive is already uploaded (this happened; see `T10` in the plan).
- **One version for both objects.** The archive and the style are keyed by `MAP_ARTIFACT_VERSION`, and the media route serves `styles/<current version>.json` only — a style uploaded under another key is invisible.
- Staging may be overwritten in place (`S2`): non-production is served `no-cache`, so a re-upload is picked up without a version bump.

Verify what is served, rather than trusting the upload:

```bash
B=https://sonora-api-staging.sonora-api.workers.dev/media/public
curl -s "$B/tiles/calamuchita/v1.pmtiles" | sha256sum     # must equal the built file
curl -s "$B/styles/v1.json" | head -c 200                # glyphs/sprite rewritten to the serving origin
```

### Two known gaps

- **`T9`** — planetiler's own downloads do not resume: a killed attempt discards its `.tmp`, so a slow-but-alive mirror can never finish the 932 MB water or 953 MB land archive. Until the two `osmdata` files are fetched by our downloader (which does resume), a cold cache may need them pre-seeded. The first real run hit exactly this: three attempts, 8 % lost each.
- **`T10`** — the upload targets do not validate `ARCHIVE`/`STYLE` before uploading, so a wrong path leaves the bucket half-updated.

## 7. Budget and next steps

**Offline budget (`T5`): holds.** The built archive is **843 052 B**, below the 846 213 B published before, against `map.download.autoMaxBytes` (8 MB, the silent-download ceiling) and `cacheMaxBytes` (100 MB, the device budget) — the ceiling is ~10× the archive and the device budget holds ~118 regions at this size. No change needed; revisit if a region's archive grows by an order of magnitude.

**What is left:**

| Task        | What it is                                                                                                             | State                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `T6`        | a trip and a track at Calamuchita show area names and the z16 POIs, offline, and the layer selector claims every layer | needs a device on the staging build |
| `T8`        | web offline, as its own stage: the browser keeps nothing today                                                         | planned, with its five conditions   |
| `T9`, `T10` | the two gaps above                                                                                                     | planned                             |
| production  | the same upload against the production bucket                                                                          | withheld until `T6` passes          |

## 7. Open decision

Adopt a self-built tileset (owning a profile and a build), or accept the current map as final for this milestone and spend the effort elsewhere. The measurements above are the input; the numbers from §5 are the ones still missing.
