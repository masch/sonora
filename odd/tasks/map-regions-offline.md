# Feature: Map Regions and Offline Download

**Feature ID:** `map-regions-offline`
**Branch:** `feat/map-regions-offline`
**Strategy:** `ask-on-risk`
**Status:** slices A and B delivered; slice C (storage, policy, prompt) is next.

## Objective

Each experience draws the region it belongs to, and the app downloads that region's archive **when the app opens** — silently on WiFi, asking on cellular. Today every map receives one global `map.archiveUrl`, so "download what you open" cannot exist.

The contract is rewritten as if from scratch: the payload carries a **catalog of regions**, the archive urls are **derived by the server** from the bucket key, and the renderer mechanism (`leaflet`/`maplibre`, platform capability, allowlist, denylist) is untouched.

## Specs

**S1 — The download happens when the app opens: WiFi silent, cellular asks**

> "me gustaria que el mapa se descargue ni bien se abre la app solo si es que esta por WIFI, si es por dato preguntar."

- **R1** — the prefetch runs after `/config` resolves at startup, never before it.
- **R2** — on WiFi and under the silent ceiling it downloads without asking; above the ceiling it asks even on WiFi.
- **R3** — on cellular it follows the policy in the payload (`ask` today): one prompt, listing the regions and their total size, never one prompt per region.
- **R4** — offline, or when the policy is `never`, it downloads nothing and the app still works.
- **R5** — only when the resolved renderer is `maplibre`: the Leaflet path draws raster OSM tiles and never reads the archive.
- **R12** — a cold start with no network draws the same map the user last saw: the style document comes from disk as well as the archive. Labels depend on the glyphs decision below.

**S2 — The renderer mechanism keeps working, with allow and block**

> "el mecanimos de leaft o maplibre va a seguir funcionando y se haiblitar por todos los mecanimos que ya existen verdad? con los allow y block"

- **R6** — the resolution chain is unchanged: build-time env → remote config → `leaflet`, and on the server platform capability → denylist → allowlist → environment.
- **R7** — a device that resolves to `leaflet` (blocked, incapable, or defaulted) downloads nothing; the prefetch reads the resolved renderer from the same payload it already trusts.

**S3 — No backwards compatibility**

> "olvidemos la retrocompatibilidad, etamos en una etapa de cmabio, revaalumos para que quede bien de base como si fuera desde 0"

- **R8** — the payload shape breaks cleanly: no legacy fields are carried "just in case", and no compiled floor exists to satisfy a payload that no longer exists.
- **R9** — the consequence is stated, not hidden: the API deploys before an app build that reads the new catalog, and a client holding an old cached payload shows the fallback style until `/config` answers.

**S4 — Product decisions taken**

> "1. A 2. OK"

- **R10** — the regions to prefetch are named by the payload (`download.preload`), chosen by the server, never guessed by the client and never "all of them".
- **R11** — `download.autoMaxBytes = 8_000_000`, `download.cacheMaxBytes = 100_000_000`, `download.cellular = 'ask'`. They are config values: adjustable without a release.

## Contract

```ts
map: {
  renderer: 'leaflet' | 'maplibre',
  styleUrl: string,
  regions: Record<string, {                    // "calamuchita"
    bbox: [west, south, east, north],           // numbers, not a string
    label: string,
    archiveUrl: string,
    archiveBytes: number,                       // from a R2 head at /config time
  }>,
  download: {
    preload: string[],
    autoMaxBytes: number,
    cacheMaxBytes: number,
    cellular: 'ask' | 'auto' | 'never',
  },
}
```

What the rewrite deletes: the top-level `map.archiveUrl`, `MAP_ARCHIVE_URL` and `MAP_STYLE_URL` (the server derives the urls from `mapArchivePath`/`mapStylePath`), the string bbox parsed on the client, the compiled artifact floor in `artifacts.ts`, and the archive file key made from the url tail.

## Tasks

- [x] **T-A: Contract and server catalog** — Refs: S3, S4; R8, R10, R11.
  - Path: `packages/shared/src/schemas/config.ts`, `packages/shared/src/map/regions.ts`, `packages/shared/src/map/artifacts.ts`, `apps/api/src/middleware/config-guard.ts`, `apps/api/src/routes/config.ts`, `apps/api/src/index.ts`, `apps/api/wrangler{,.staging}.toml`, `apps/mobile/src/hooks/use-map-view-config.ts`
  - Action: new `map` shape; `bboxTuple()` in shared; `/config` builds `regions` from `MAP_REGIONS` × `head` on the public bucket, omitting unpublished regions; urls derived from the version, not from env; drop the two env vars; `useMapViewConfig` reads the catalog and compiles without the experience (default region) until T-B.
  - Proof: shared schema tests (a payload with the new shape parses; the old one does not), api config tests (published region included with its size, unpublished omitted, style url derived, renderer precedence untouched), `validate-api` + `validate-mobile` green.
  - Route: worker. Delivered: `99c5a1b` (catalog) + `42e6689` (bucket head timeout, no guessed region).

- [x] **T-B: Region resolution per experience** — Refs: S1; R10.
  - Path: `packages/shared/src/map/regions.ts`, `apps/mobile/src/hooks/use-map-view-config.ts`, `apps/mobile/src/components/map/{trip-map,experience-map-switch,track-detail-map}.tsx`, `apps/mobile/src/components/track-detail-view.tsx`, `apps/mobile/src/components/trip-detail-view.tsx`
  - Action: `regionForPoint(regions, point)` pure, edge inclusive; the two call sites pass the experience's coordinates; an experience outside every bbox draws the reference plane over the fallback style plus one honest line (decision: no nearest-region guess).
  - Proof: `regionForPoint` edge-inclusive in four edges + four corners, just-outside, overlapping catalogs in both orders, empty catalog, missing and non-finite point. Mobile: a point inside a region draws that region's archive, a point outside resolves `null` and attempts no download, the no-region line renders instead of the archive-missing error, and a known region with a missing archive still reports the error. Shared 265, api 651, mobile 907; `tsc` clean in api and mobile; lint 0 errors.
  - Delivered: `regionForPoint` + `useMapViewConfig(point)` + `MapSourceConfig.regionKey` (`null` = resolved as no region, absent = never resolved) so T-C can key `<region>-<version>.pmtiles` without a second prop. The no-region map draws the reference plane over a basemap-less style with `map.noRegion`, deliberately not the remote style: its basemap points at an archive this device never downloaded. The verifier's open nit from slice A (an armed `HEAD_TIMEOUT_MS`) is folded in. Commit: `a6dc18f`.

- [ ] **T-C1: Archive identity, budget and download policy** — Refs: S1, S4; R2-R4, R11.
  - Path: `apps/mobile/src/services/map-archives.ts` (new), `apps/mobile/src/services/map-download-policy.ts` (new), `apps/mobile/src/hooks/use-map-archive-file.ts`, tests
  - Action: one name per archive (`<region>-<version>-<origin>.pmtiles`), the directory listing as the index, a pure eviction plan over `cacheMaxBytes` that never drops the archive in use, and `decideDownload({bytes, network, policy})` as a pure policy.
  - Proof: identity from the shared generator's url and rejection of a url that names no version; two hosts and two regions never share a file; listing ignores temporaries and foreign files; eviction order, budget arithmetic and "never the current one"; the policy matrix (offline / WiFi under, at and over the ceiling / cellular ask-auto-never / an unpriced network).
  - Delivered: the hook takes the source (archive + region) instead of a bare url, so a map in no region downloads nothing at all. Commit: pending.

- [x] **T-C2: The startup prefetch and its one prompt** — Refs: S1, S4; R1-R4, R11.
  - Path: `apps/mobile/src/hooks/use-map-prefetch.ts` (new), `apps/mobile/src/components/map/` (prompt), `apps/mobile/src/app/_layout.tsx`, locales
  - Action: after `/config` resolves and only when the resolved renderer is `maplibre`, price the `download.preload` set, run `decideDownload` once for the total, download silently or ask with one `BottomModal`, evict down to `cacheMaxBytes` before each transfer, and offer "prepare this trip" as the explicit action.
  - Proof: nothing runs before the payload exists or under `leaflet`; silent download under the ceiling; one prompt for the whole set showing the total size; offline downloads nothing and the app still works; eviction runs before a transfer.
  - Delivered: `useMapPrefetch` (payload signature, one decision for the whole set, already-downloaded regions excluded from the price) + `MapDownloadPrompt` (one `BottomModal`, `formatBytes` in the reader's language) mounted in the root layout. Proof: 10 new tests over the seven cases above, full mobile suite 109/944, `tsc` clean, lint 0 errors. A verifier-leg of the review found the hook marked a payload handled _before_ the run decided, which under React's development double-invoke would have downloaded nothing and asked nothing: the mark moved after the cancellation check. Commit: pending.
  - Advisories accepted, not fixed here: a dismissed prompt is remembered by the hook instance, so a remount in the same session asks again; a silent download that fails is not retried until the payload changes, and the map's own error is the only surface.

- [x] **T-C3: "Prepare this trip" as an explicit action** — Refs: S1, S4; R3.
  - Path: `apps/mobile/src/components/map/` (trip surface), locales
  - Action: a button on the trip screen that downloads that trip's region on demand, for a walker who wants the map prepared before leaving. The startup prefetch already covers the set the payload names; this is the per-trip decision, and it must not become a second policy engine — it reuses `ensureArchiveOnDisk` with the payload's budget.
  - Proof: the button downloads the trip's region once, reports when it is already there, and does nothing under `leaflet`.
  - Delivered: `MapDownloadButton` — self-contained (its own state, no `useState` in the trip view), silent under `leaflet` and for a point in no region, `available` and disabled when the archive is already on the device, one transfer with the payload's budget, and a retryable failure line. Placed under the mini map in the trip details card. Proof: 6 tests over those states, full mobile suite 110/950, `tsc` clean, lint 0 errors, doctor 100/100. It is not a second policy engine: no network decision and no prompt — a tap is the answer.

- [x] **T-E1: Self-hosted glyphs and sprite, and a style that tells the truth** — Refs: S1; R12.
  - Delivered: `mapGlyphsPath`/`mapSpritePath` (no version segment: fonts and sprite are content, not per-artifact builds; the sprite is a base because MapLibre appends `.json`/`.png`/`@2x.png`), a serve-time rewrite in `GET /media/public/:key` that points `glyphs`/`sprite` at this origin and re-points every `pmtiles://` source at the origin that served the request (fixing the staging→production leak of L14, defect 2), and `make api-upload-map-assets-{staging,production}` over a `MAP_ASSETS_DIR` tree with per-extension content types, immutable cache and mandatory `--remote`.
  - Proof: shared 269, api 660, `tsc` clean, lint 0 errors; new shared tests pin both paths (placeholders kept, sprite base extension-less, no version segment), and new media tests pin that a style key is rewritten (glyphs, sprite, basemap origin), that every other key is streamed byte-for-byte, and that malformed or version-less JSON falls back to the stored bytes with a warning instead of a 500. The upload target was dry-run against a temporary asset tree, including a font stack with a space in its directory name.
  - Not fixed by this slice: **production still has no style object** (L14, defect 1) — that is an upload, not code, and it is the human's.

- [ ] **T-E2: The style survives a cold start, and labels come from the device** — Refs: S1; R12.
  - Path: `apps/mobile/src/services/` (style persistence, glyphs/sprite download), `apps/mobile/src/components/map/experience-map.tsx`, `apps/mobile/src/hooks/use-map-source.ts` (web), locales
  - Action: persist the style document in `map-styles/` with the same atomic write the archives use, and load it when the fetch cannot answer (chain: network → disk → fallback style, never a cache read in the render body — `no-module-state-style-read.test.ts` forbids it). Download the font ranges the style actually uses and the sprite next to it, then rewrite the style's `glyphs`/`sprite` to `file://` paths before handing it to MapLibre — this is the experiment L15 describes: MapLibre Native's own resource loader reads `file://`, so names may work offline with no protocol API at all.
  - Proof: a persisted style is used when the fetch fails and a missing one still falls back; every `text-font` the style names has its ranges on disk; the rewritten document points at files that exist; the device check in airplane mode answers the experiment either way.

- [ ] **T-E3: The offline style on the web renderer** — Refs: S1; R12.
  - Action: the same disk chain through the `sonora://` scheme the web renderer already registers, so a browser reload with no network draws the map it drew before.
  - Proof: a test that the web source reads the persisted style when the fetch fails.
  - Path: `apps/mobile/src/components/map/experience-map.tsx`, `apps/mobile/src/hooks/use-map-archive-file.ts`, `apps/mobile/src/services/` (style persistence), locales
  - Action: persist the style document next to the archive (`map-styles/<version>.json`, atomic write) and load it from disk when the fetch cannot answer; the chain is disk → network → fallback style. Decide the glyphs question (self-hosted glyphs and sprite on R2 for labels offline, or accept a basemap without labels offline) and record it here.
  - Why this is not optional: the archive is on disk and the reference documents ride the cached `/experiences` payload (`BaseApiClient` reads from `cacheKey` storage when the fetch fails), but the **style document** is fetched raw and kept in a module-scope memory map, so a cold start with no network has the archive and no style — no base layers, blank map. The measured style is 268 KB, 71 layers, with remote `glyphs`/`sprite` on `protomaps.github.io`, so labels and icons are the second gap.
  - Proof: a test that a persisted style is used when the fetch fails, and that a missing persisted style still falls back; device check in airplane mode after a normal first run.

- [ ] **T-D: Device verification** — Refs: S1; R1-R5.
  - Action: airplane mode (nothing downloaded, app usable), first run on WiFi (silent), first run on cellular (one prompt), eviction with two regions, and the Leaflet device downloads nothing. Record in the map feature's T7 list.

## Log

- **L1** (the request that opened this): asked how T8 would work, to evaluate before starting. The evaluation read `regions.ts`, the config schema, `use-map-config`, `use-map-archive-file`, `media.ts` and the installed deps, and proposed region resolution by bbox, a size known from R2 at `/config` time, an LRU index, and slices A-D.
- **L2** (the requirement that moved the trigger): "me gustaria que el mapa se descargue ni bien se abre la app solo si es que esta por WIFI, si es por dato preguntar." — the download is a startup concern, not a per-screen one, and the network decides the prompt. Consequence recorded: the prefetch must know the resolved renderer, because Leaflet never reads the archive.
- **L3** (renderer continuity): confirmed in code that nothing about `leaflet`/`maplibre` changes — `resolve-renderer.ts` keeps env → remote → leaflet, and the server keeps platform capability → denylist → allowlist → environment. T8 only moves where the url comes from and when it downloads.
- **L4** (from zero): "olvidemos la retrocompatibilidad, etamos en una etapa de cmabio, revaalumos para que quede bien de base como si fuera desde 0." — everything that existed only to keep old payloads parsing was dropped: the top-level `archiveUrl`, the two wrangler vars, the compiled floor, and the url-tail archive key. The deploy-order consequence is in S3-R9 instead of being left implicit.
- **L5** (the two decisions): "1. A 2. OK" — the payload names the preload set (`download.preload`), and the numbers are 8 MB silent ceiling, 100 MB cache, `cellular: 'ask'`.
- **L6** (the question that found a hole in this design): "como funciona si un usuario entra por primera vez, se descarga los mapas y se ven bien. se cierra la app sin datos, se ven los mapas en forma offline?" — and the honest answer was **no**, as specified. The archive is on disk and the reference documents survive too — the experiences list is fetched with a `cacheKey` and `BaseApiClient` reads that storage when the fetch fails, which is how audio and the list already work offline. Two network dependencies do survive: the **style document** lives only in a module-scope memory map, and the style's `glyphs`/`sprite` point at `protomaps.github.io`. So a cold start offline has an archive and no style, which is a blank basemap. An earlier version of this entry claimed the app does not cache experiences; that was wrong and the human caught it — the correction matters because it shrinks T-E to the style and the glyphs instead of inventing an app-wide offline feature. T-E and R12 exist because of this question. It also surfaced a publishing defect worth its own fix: the **staging** style document embeds `sources.basemap.url` pointing at **production** tiles; the native path masks it by replacing the source with the local archive, the web path would fetch production tiles from staging.
- **L7** (how the style gets persisted, and what "parity" costs): asked whether to reuse the client's cache or write our own, the answer was to reuse it — **the style is fetched through `ApiClient` with a `cacheKey`**, so the offline fallback that already serves the experiences list serves the style too, and no second cache mechanism is written. The open question is the _sprite_ and the _glyphs_, so they were measured on the published style instead of guessed: **13 layers draw text** using **three font stacks** (`Noto Sans Regular`, `Medium`, `Italic`, plus an expression choosing Medium/Regular by zoom) and **4 layers draw icons** (`arrow`, station, network shields) from the sprite. Neither lives in the PMTiles archive — the archive carries geometry, and the style points at `glyphs`/`sprite` on `protomaps.github.io`, a third party. So a cold start with no network draws land, water and roads but no names and no icons. "Parity" means caching those assets too: roughly 4 glyph ranges × 3 fonts (≈0.5-1 MB) plus `sprite.json` + `sprite.png` + `@2x` (≈0.1-0.3 MB), i.e. **~1-1.5 MB once, shared by every region**. Self-hosting them on our R2 would also remove the third-party runtime dependency, which is worth something on its own: today a slow or blocked `protomaps.github.io` degrades labels even with full connectivity.
- **L8** (the region comes from the walker's coordinates, and "nowhere" is a fact): T-B replaced the strict-preload heuristic with `regionForPoint` over the catalog. The four tests that pinned the heuristic were rewritten, not deleted, because they were pinning the wrong rule. Design calls worth keeping: `regionKey` rides on `MapSourceConfig` so the archive and its region are one decision, and it has **three** states — a key, `null` for "resolved, no region", absent for "never resolved" — which is what keeps the honest no-region line distinguishable from a map that lost its archive. With no region the map draws the reference plane over a basemap-less style rather than the remote style, whose basemap points at an archive this device never downloaded: a canvas that fails to fetch tiles looks broken, while a map of references with one line of copy tells the truth. The web renderer got the same rule for consistency, and its dedicated test file stayed untouched (out of this slice's surface), which is recorded as a gap rather than as proof.
- **L9** (the slice boundary, recorded before slice C): the pre-commit gate counted **1809 authored lines across the four commits** on `feat/map-regions-offline` since `origin/main` (`1e1f1fd` spec, `99c5a1b` catalog, `42e6689` bucket head, `a6dc18f` region resolution), so slices A and B already exceed the ~400-line review slice. The branch is unpushed and has no PR. Consequence: A+B are a reviewable unit of their own, and T-C (storage, policy, prompt) plus T-E (style persistence) come after it as a second unit — otherwise one PR carries five concerns.
- **L10** (the index the plan asked for, deleted before it was written): the spec said "files keyed `<region>-<version>.pmtiles` plus an index (`{region, version, bytes, lastUsedAt}`) written atomically". Three facts killed the index file: the name already carries the region and the version, the platform's `File` reports `size` and `modificationTime`, so the directory listing _is_ the index — and a second copy of the same facts is state that can drift, needs an atomic write, and has no meaning when it is lost. Two consequences accepted and stated: recency is "least recently **downloaded**", because nothing touches the file on read and an archive is only ever written once, and the host is part of the name (`calamuchita-v1-1a2b3c4d.pmtiles`) so staging, production and a local wrangler cannot answer each other's request with the wrong bytes — the same reason the old key fingerprinted the whole url. The version is not in the payload, so it is read from the tail of the url the shared `mapArchivePath` builds; a test asserts that parse against that generator rather than against a hand-written url, and a url that does not end in `<version>.pmtiles` has no identity at all instead of a key nobody can reason about.
- **L11** (what the prompt ended up being, and three accepted edges): the question is asked once for the whole set, in one sheet, with the total the walker is really approving — `2,4 MB en total`, not a prompt per region. Sizes are formatted 1000-based in the reader's language, because the number comes from a `Content-Length` and the ceiling it is compared against is decimal too. Already-downloaded regions are priced out before the decision, so a second launch asks about nothing. Three edges are recorded rather than engineered away: a dismissed prompt is remembered by the hook instance (a remount in the same session asks again — invisible today, since the component is mounted once in the root layout), a silent download that fails is not retried until the payload changes and the map's own error is the surface, and the `handled` mark now lands after the cancellation check so React's development double-invoke cannot leave a payload unhandled.
- **L12** (the second slice boundary): slices C1 and C2 land on `feat/map-regions-download`, stacked on the A+B branch, as their own PR against it. The counter after the C2 commit reads 3767 authored lines since `origin/main`, of which 1810 are the already-open A+B PR; the C slice itself is the rest. C3 (the per-trip action), E (style persistence) and D (device verification) stay open.
- **L13** (the labels decision for T-E): the human chose **self-hosting the glyphs and the sprite on our R2** over accepting a basemap without names offline, and over caching the third party's files. Cost is the T-E work itself — the assets are ~1-1.5 MB once for every region, uploaded by the human like the other bucket artifacts — and the payoff is not only offline parity: the style stops pointing `glyphs`/`sprite` at `protomaps.github.io` at runtime, so a slow or blocked third party can no longer degrade labels even with full connectivity. Consequence recorded: the published style document has to be rewritten to our media paths, which is a server/tooling change alongside the client's disk persistence, and the upload is the human's, not the agent's.
- **L14** (the survey that corrects L13's premise): the style pipeline has no generator in this repo — `styles/<version>.json` is authored outside and uploaded with `make api-upload-map-style-*` — and two defects surfaced while checking it: **production has no style object at all** (`/media/public/styles/v1.json` answers 404 while `MAP_ARTIFACT_VERSION = "v1"` is set in both wrangler files, so a production client is handed a url that cannot answer), and the **staging** document embeds `sources.basemap.url` pointing at **production** tiles, which native masks by replacing the source with the local archive and web does not. The correction that matters: **self-hosting glyphs and the sprite on our R2 does not, by itself, put names and icons on the map offline.** MapLibre Native fetches `glyphs` and `sprite` over HTTP itself, and `@maplibre/maplibre-react-native@11.5.0` exposes no `addProtocol` (recorded in the other feature's L22), so only the web renderer has the `sonora://` scheme that can serve a file from disk. Self-hosting still buys the removal of a third-party runtime dependency — labels stop depending on `protomaps.github.io` when the network is slow or blocked — and it is the prerequisite for any future on-disk scheme, but a cold start with no network on a device still draws a basemap without names unless the reader is online. The decision needs restating in those terms.
- **L15** (the addProtocol investigation, answered): there is no version to upgrade to. `@maplibre/maplibre-react-native` is at **11.5.0**, which is exactly what the app installs, and `npm view` lists nothing above it. Upstream, the capability itself is unfinished: `maplibre-native` issue **#3562** "Allow registering custom URL schemes (addProtocol)" is open, and the PR that would deliver it — **#3703**, "Adds plugin support for style filtering, tile data reading and custom protocol handlers" — is still a draft. So the native renderer cannot be handed a JS loader for `glyphs`/`sprite` today, and no dependency change buys it. What the native renderer _does_ support is the `file://` scheme in its own resource loader (it is how `pmtiles://file://…` archives are read), which suggests a cheaper experiment than a protocol API: point the style's `glyphs` template at files on the device (`file://…/glyphs/{fontstack}/{range}.pbf`) and let MapLibre read them itself. That is unverified and belongs to the device slice — it either draws names offline or it does not, and it costs one build to know.
