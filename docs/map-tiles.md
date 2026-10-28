# Map Tiles: What The Map Can Draw, And What It Would Take To Match OSM

Operator and engineer reference for the base map. It records what was **measured** on the published artifacts, so the analysis does not have to be repeated, and it states the one open decision.

Companion page: [Map Assets Pipeline](map-assets-pipeline.md) covers how the style, glyphs and sprite reach a device.

---

## 1. Where the map comes from today

| Piece            | Value                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Renderer         | MapLibre (native and web), fed by `GET /config`                                                                           |
| Style            | Protomaps light, 71 layers, served from our bucket and **rewritten in flight** (`glyphs`, `sprite`, `pmtiles://` origins) |
| Tiles            | one PMTiles archive per region, `tiles/<region>/<version>.pmtiles`                                                        |
| Archive measured | `calamuchita/v1.pmtiles`, **846 213 bytes**, PMTiles v3, **z0–15**                                                        |
| Offline          | native keeps the archive on disk and reads `pmtiles://file://…`; the browser streams it over HTTP                         |

The style document is repository source: `assets/map/styles/v1.json`, guarded by `packages/shared/src/__tests__/basemap-style.test.ts`.

## 2. What the archive actually carries

Read from the archive's own `vector_layers` metadata, not assumed:

| Layer        | zooms | has `name` | fields that matter                                       |
| ------------ | ----- | ---------- | -------------------------------------------------------- |
| `earth`      | 0–15  | **yes**    | kind, min_zoom, translated names                         |
| `landuse`    | 2–15  | **no**     | kind, sort_rank                                          |
| `landcover`  | 0–7   | no         | kind                                                     |
| `places`     | 1–15  | yes        | kind, **kind_detail**, min_zoom, population              |
| `pois`       | 5–15  | yes        | kind, **kind_detail**, min_zoom                          |
| `roads`      | 3–15  | yes        | kind, kind_detail, ref, **shield_text**, network, oneway |
| `water`      | 0–15  | yes        | kind, kind_detail, min_zoom                              |
| `buildings`  | 11–15 | **no**     | addr_housenumber, height, kind                           |
| `boundaries` | 0–15  | **no**     | kind, brk_a3, disputed                                   |

## 3. Why the map does not look like OpenStreetMap

Not a style problem. Three measurements settle it:

1. **Area names cannot exist.** `landuse` has 11 layers in the style and **all of them are fills**; there is no symbol layer. And even if there were one, `landuse` carries no `name` field: "Bosque Umepay" or "Huerta Madre" are not in our tiles at all.
2. **The POI set is complete for what we carry.** The sprite has 53 icons; 34 are POI kinds and the style already admits every one of them. The apparent 35th, `train_station`, is the icon the already-admitted kind `station` resolves to. Nothing left to add without new data.
3. **Place granularity was never missing.** `places_locality` filters on `kind == "locality"`, and in this archive every village, hamlet and isolated dwelling _is_ exactly that — a finer `kind_detail` layer drew a second label on the same point, which is why it does not exist.

What OSM shows and we cannot, for the same reason — the data is not there:

- names on forests, meadows, orchards, farms, and on buildings;
- POIs at the zoom OSM shows them (z16+), and addresses (`address_label` asks for **z18**);
- one-way arrows and the rest of the z16 detail.

## 4. The options, honestly priced

| Path                                                             | What it buys                                                              | Cost                                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Extend the style only**                                        | road shields on more classes, finer place labels, water and island labels | **Already exhausted** by the measurements above: nothing left that the data supports                                                     |
| **Own tile build** (planetiler or tilemaker, custom profile)     | the missing names, a full POI table, and z16–17 depth                     | a profile to own, a build to run per region, and a much larger archive — which changes the offline budget (`autoMaxBytes` is 8 MB today) |
| **Third-party vector basemap** (MapTiler, Stadia, OSM Americana) | a richer map fastest                                                      | a dependency, a bill, a usage policy, and the end of "our bucket, our offline"                                                           |

The middle path is the only one that closes the gap, and its cost is exactly what the spike below measures.

## 5. The spike: a self-built tileset at z16, measured

Recorded so it can be re-run; its numbers live in the tracking issue.

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

## 6. If the pipeline is adopted

- The profile and the build commands become repository source, next to `assets/map/styles/`, and the archive is published with the existing `make api-upload-map-tiles-*` targets. Our delta over the upstream profile lives in [`scripts/map-tiles/`](../scripts/map-tiles/README.md) — three patches on a pinned commit, with the reasoning for that shape written there.
- A new artifact version is a bucket key, so nothing needs invalidating: `MAP_ARTIFACT_VERSION` moves and clients follow.
- Revisit the offline budget: `autoMaxBytes` (8 MB) and `cacheMaxBytes` (100 MB) in `map.download` were set against an 846 KB archive.
- The size check added in #576 (`isArchiveCurrent`) already re-downloads a region whose bytes changed, so overwriting in place keeps working at the new scale.

## 7. Open decision

Adopt a self-built tileset (owning a profile and a build), or accept the current map as final for this milestone and spend the effort elsewhere. The measurements above are the input; the numbers from §5 are the ones still missing.
