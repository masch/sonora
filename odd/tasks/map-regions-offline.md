# Feature: Map Regions and Offline Download

**Feature ID:** `map-regions-offline`
**Branch:** `feat/map-regions-offline`
**Strategy:** `ask-on-risk`
**Status:** specced from zero (no backwards compatibility); slice A ready to start.

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

- [ ] **T-A: Contract and server catalog** — Refs: S3, S4; R8, R10, R11.
  - Path: `packages/shared/src/schemas/config.ts`, `packages/shared/src/map/regions.ts`, `packages/shared/src/map/artifacts.ts`, `apps/api/src/middleware/config-guard.ts`, `apps/api/src/routes/config.ts`, `apps/api/src/index.ts`, `apps/api/wrangler{,.staging}.toml`, `apps/mobile/src/hooks/use-map-view-config.ts`
  - Action: new `map` shape; `bboxTuple()` in shared; `/config` builds `regions` from `MAP_REGIONS` × `head` on the public bucket, omitting unpublished regions; urls derived from the version, not from env; drop the two env vars; `useMapViewConfig` reads the catalog and compiles without the experience (default region) until T-B.
  - Proof: shared schema tests (a payload with the new shape parses; the old one does not), api config tests (published region included with its size, unpublished omitted, style url derived, renderer precedence untouched), `validate-api` + `validate-mobile` green.
  - Route: worker. Commit: pending.

- [ ] **T-B: Region resolution per experience** — Refs: S1; R10.
  - Path: `packages/shared/src/map/regions.ts`, `apps/mobile/src/hooks/use-map-view-config.ts`, `apps/mobile/src/components/map/{trip-map,experience-map-switch,track-detail-map}.tsx`, `apps/mobile/src/components/track-detail-view.tsx`, `apps/mobile/src/components/trip-detail-view.tsx`
  - Action: `regionForPoint(regions, point)` pure, edge inclusive; the two call sites pass the experience's coordinates; an experience outside every bbox draws the reference plane over the fallback style plus one honest line (decision: no nearest-region guess).
  - Proof: pure tests inside/on-edge/outside; component test that the archive requested is the region's; a test that no region means no download attempted.

- [ ] **T-C: Storage, policy and the prompt** — Refs: S1, S4; R2-R4, R11.
  - Path: `apps/mobile/src/hooks/use-map-archive-file.ts`, `apps/mobile/src/services/` (download policy), `apps/mobile/src/components/map/` (prompt), `apps/mobile/src/app/_layout.tsx`, locales
  - Action: files keyed `<region>-<version>.pmtiles` plus an index (`{region, version, bytes, lastUsedAt}`) written atomically; `decideDownload({bytes, network, policy})` pure; LRU eviction under `cacheMaxBytes`, never the region in use; one `BottomModal` prompt for the preload set; "prepare this trip" as the explicit action.
  - Proof: policy matrix (offline / WiFi under and over the ceiling / cellular ask-auto-never), eviction order and "never evict the current one", index round-trip, prompt renders the total size and can be dismissed with the map still usable.

- [ ] **T-E: The map survives a cold start with no network** — Refs: S1; R12.
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
