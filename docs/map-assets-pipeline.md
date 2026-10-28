# Map Assets Pipeline (Sonora)

How the base-map style reaches a walker's device, and the three commands that keep the self-hosted glyphs and sprite in the bucket they are served from.

This document is operator-facing: what each step does, when it has to be re-run, and what breaks if one is skipped.

---

## 1. The mental model: the style is rewritten in flight

The style document lives in this repository at `assets/map/styles/v1.json`, and the object in the public bucket is a copy of it. The API does **not** serve those bytes as stored: `GET /media/public/styles/<version>.json` reads the object, and answers with

- `glyphs` → `<origin>/media/public/glyphs/{fontstack}/{range}.pbf`,
- `sprite` → `<origin>/media/public/sprites/light`,
- every `pmtiles://` source re-pointed at **the origin that served the request** (so staging cannot hand a browser production tiles).

Consequences worth holding in mind:

- **The bucket object keeps absolute urls of its own; clients never see them.** `glyphs` and `sprite` are replaced whatever they say, and a `pmtiles://` source keeps its path and takes the origin that served the request — so re-pointing those urls in `assets/map/styles/v1.json` at our own bucket changes nothing a client requests, while a relative or missing value would leave the rewrite with nothing to splice an origin into.
- The urls a client requests are **ours**, so the objects behind them have to exist in **our** bucket. That is the whole reason for this pipeline.
- The sprite is a **base**, not a directory: MapLibre appends `.json`, `.png`, `@2x.json` and `@2x.png` itself, so the keys are `sprites/light.json`, `sprites/light.png`, `sprites/light@2x.json` and `sprites/light@2x.png`. A tree shaped like `sprites/light/sprite.json` uploads happily and 404s forever, and shipping three of the four leaves every high-density phone asking for a file that was never uploaded — a device log is what caught that one.

### The style document is repository source, not a bucket upload

`assets/map/styles/v1.json` is the source of truth: the bucket object is still what clients are served, and the API still rewrites `glyphs`, `sprite` and every `pmtiles://` origin at serve time. The path mirrors the bucket key (`styles/v1.json`) because nothing is renamed on the way up.

The committed document names a reserved origin that exists nowhere (`https://map-assets.invalid`, which RFC 2606 keeps from ever resolving), and the API replaces `glyphs`, `sprite` and the source origin on every request, so the file names no environment and a rewrite regression fails loudly instead of quietly serving another environment's data.

**It is committed as 2-space JSON, on purpose.** The document is hand-edited — a filter widened, a label layer added — and one 65 KB line makes every one of those changes invisible in review. `.prettierignore` lists `assets/map/styles/`, so nothing reformats the file unbidden and the indentation is ours to keep; re-emit it the same way with

```bash
bunx prettier --ignore-path /dev/null --write assets/map/styles/v1.json
```

which only re-indents: the parsed document is unchanged, and the ignore path is what makes prettier skip the entry that keeps it out of the check.

**A layer may only name fields the archive carries.** Labels and shields are decided against the published archive, not against the upstream schema, and three measurements settle what this map can show:

- `roads_shields` needed no widening. The archive carries `shield_text` on 59 of its 670 road features, all of them `highway` (3) or `major_road` (56); `minor_road` and `aeroway` carry a `ref` but never a `shield_text`, which is the field the layer labels with.
- The `pois` filter needed no new kind. Of the sprite's 53 icons, 34 are POI kinds and every one is already admitted; the apparent 35th, `train_station`, is the icon that the already-admitted kind `station` resolves to, not a kind of its own.
- Places needed no finer layer. `places_locality` filters on `kind == "locality"` alone, and in this archive every village, hamlet and `isolated_dwelling` is exactly that: promoting `kind_detail` would have drawn a second label on the same point.

A label layer over a source layer with no `name` — `landuse`, `buildings`, `boundaries` — draws nothing at all, which is why none exists here: the archive carries no names for those.

Publish it with the same target that publishes the archive, naming the file where the repository keeps it:

```bash
make api-upload-map-tiles-staging REGION="calamuchita" VERSION="v1" ARCHIVE="path/region-v1.pmtiles" STYLE="assets/map/styles/v1.json"
```

`packages/shared/src/__tests__/basemap-style.test.ts` guards the document against the layer-group vocabulary: every layer it draws is either claimed by a group of `MAP_LAYER_GROUPS` or written down as canvas no toggle may hide, so an edit that escapes the layer selector fails the suite instead of shipping. In a non-production environment an overwritten object is revalidated on the next load (`no-cache`), while production keeps `immutable` because its urls are versioned.

---

## 2. The three steps

```
style published ──▶ fetch ──▶ upload ──▶ verify ──▶ device
 (author + make)   (derive)   (R2)        (prove)
```

### Step 1 — fetch: derive the file list from the style, and download it

```bash
make map-assets-fetch                                  # staging style by default
make map-assets-fetch STYLE_URL=<url> MAP_ASSETS_DIR=map-assets   # another style, another directory
```

Reads the style document, works out every file a client would request from it — the font stacks its layers name, crossed with the ranges the app downloads, plus the four sprite files — and writes them into `map-assets/` laid out exactly as the bucket expects:

```
map-assets/
├── glyphs/<fontstack>/<range>.pbf     # e.g. glyphs/Noto Sans Regular/0-255.pbf
└── sprites/light.json | light.png | light@2x.json | light@2x.png
```

Ten files, not nine: the `@2x` sprite is a document _and_ an image. It skips a file already on disk with the same size (use `--force` to re-download), prints one line per file with its size, and exits non-zero if any file failed. **Nothing is hardcoded**: the stacks come from the style, the ranges and keys come from `packages/shared/src/map/glyphs.ts`, and the upstream revision is the single constant `MAP_ASSET_SOURCE_VERSION` there.

Why the list is derived rather than written down: the day the style names a fourth font stack, a hand-written list is silently wrong and the only symptom is missing labels on a device.

### Step 2 — upload: put the files where the client asks for them

```bash
make api-upload-map-assets-staging
make api-upload-map-assets-production
```

Walks `MAP_ASSETS_DIR` (default `./map-assets`), and uploads **one object per file** with `wrangler r2 object put --remote`, the content type picked from the extension (`.pbf` → `application/x-protobuf`, `.json` → `application/json`, `.png` → `image/png`) and `cache-control: public, max-age=31536000, immutable`.

Two things about this target that bite:

- **`--remote` is mandatory.** Without it wrangler writes to its local Miniflare simulation and the deployed Worker keeps seeing an empty bucket.
- **The relative path is the key.** `map-assets/glyphs/X/0-255.pbf` becomes `glyphs/X/0-255.pbf`. Nothing is renamed on the way up, so the layout from step 1 is the contract.

`map-assets/` is gitignored: the assets are third-party content, not repository source.

### Step 3 — verify: prove the bucket serves what the style asks for

```bash
make map-assets-verify
```

Probes every public url the style implies against the serving origin, and asserts `200` plus the expected content type. It prints a table and, when something is missing, **exits non-zero naming the exact keys to upload**:

```
  MISS  glyphs/Noto Sans Regular/0-255.pbf   HTTP 404   application/json
9 of 9 objects are not published as the style needs them.
```

That output is the point of the step: it turns "labels look wrong on staging" into a list. It is also the check worth wiring into a release, because it is the only one that looks at the deployed bucket rather than at the code.

---

## 3. When to run it (and when not to)

**Not periodically.** These files are pinned content: upstream publishes by _directory_ (`sprites/v4`, `sprites/v5`) and the objects are uploaded with a year of immutable cache, so re-uploading the same key reaches nobody — not the CDN, not a device. A calendar-based job would burn time and change nothing.

Re-run `fetch` + `upload` (then `verify`) when one of these is true:

| Trigger                                                      | Why                                               |
| ------------------------------------------------------------ | ------------------------------------------------- |
| The style names a font stack we never uploaded               | those labels fall back to no glyphs               |
| `GLYPH_RANGES` in `packages/shared/src/map/glyphs.ts` widens | a new range has no file in the bucket             |
| Upstream publishes a new revision we adopt (`v4` → `v5`)     | bump `MAP_ASSET_SOURCE_VERSION` first, then fetch |
| A bucket is new or recreated (fresh environment)             | it starts empty                                   |

Everything else — new regions, a republished archive, a style with the same fonts — needs no asset step.

---

## 4. What breaks when a step is skipped

| Skipped                          | Symptom                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `fetch`                          | `upload` has nothing to send: the bucket stays empty and `verify` reports every key missing |
| `upload` (or `--remote` missing) | `verify` reports 404s; the map draws land, water and roads with **no labels and no icons**  |
| `verify`                         | the gap is found on a device instead of in a terminal                                       |
| all three, on production         | the same, on production                                                                     |

The failure is quiet by design: MapLibre drops a missing glyph range and keeps drawing, so nothing throws. `verify` is what makes it loud.

---

## 5. Where the code lives

| Concern                                                                                     | File                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Bucket keys and public paths                                                                | `packages/shared/src/map/artifacts.ts`     |
| Glyph ranges, sprite suffixes, font-stack reading, and the file list a style implies        | `packages/shared/src/map/glyphs.ts`        |
| The HTTP client the tooling uses (timeout, bounded retry, typed errors, injected transport) | `packages/shared/src/map/assets-client.ts` |
| The `fetch` / `verify` verbs                                                                | `scripts/map-assets.ts`                    |
| The upload targets                                                                          | `Makefile` (`api-upload-map-assets-*`)     |
| Serve-time rewrite                                                                          | `apps/api/src/routes/media.ts`             |
| The device side: which assets it downloads and the `file://` rewrite                        | `apps/mobile/src/services/map-styles.ts`   |

The client downloads only the ranges in `GLYPH_RANGES`. A label that needs a range outside them draws without that character — the documented limit, not a bug. Widening the list is a one-line change plus a re-run of this pipeline.

---

## 6. Known limitations

- **Asset growth on the device.** `map-styles/` keeps the glyphs and sprite of a republished style that no longer names them. Pruning them needs a moment where **no style is being drawn** (cold start before any map exists, or an explicit action) — a sweep on the render path was attempted, rejected by review, and withdrawn. See `odd/tasks/map-regions-offline.md`, L20.
- **Offline labels on native are unproven.** The style can be pointed at `file://` assets when every file is present, and whether MapLibre Native honours that is a device question, not a code question. Until a build answers it, treat an offline map as drawing without names.
- **Licensing of the copied assets.** The glyphs and the sprite come from `protomaps/basemaps-assets`, which GitHub does not report an SPDX licence for; the fonts are Noto (OFL) and the sprite derives from OSM/OpenMapTiles data. The style already attributes OSM for the basemap tiles, which is not the same as covering the fonts and the sprite. Confirm the terms before this content is served from a production bucket.
