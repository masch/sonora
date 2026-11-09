# Feature: Map Failure Telemetry

**Feature ID:** `map-failure-telemetry`
**Branch:** `feat/map-failure-telemetry`
**Strategy:** `ask-on-risk`
**Status:** in progress.

## Objective

A map that cannot draw is visible to the walker and invisible to us: the renderer logs
to a console nobody can read from the outside, and no map module ever reaches
`AnalyticsService`. This feature gives every map failure one bounded, deduplicated
analytics report and the fields that tell its causes apart, keeps the full detail in the
console log, and turns a stalled web load into a reportable code instead of an endless
spinner.

## Specs

S1 — The failure has to reach analytics without asking the walker for anything.
Quoted request: _"no puedo pedirle eso al cleinte, que cmbios podemos hacer para logear el error y verlo en analytics?"_

S2 — The console keeps every event with full detail; analytics receives the summary.
Quoted request: _"porqiue no agregar todos los logs?"_
Decision recorded in this conversation: "sí a todos los logs, no a todos los eventos" —
the console is the complete record, analytics is the bounded, deduplicated summary that
travels.

S3 — One analytics report per failure episode, not per event: MapLibre emits `error` once
per failing tile, and Crashlytics keeps only the most recent eight non-fatal exceptions
per session while GA4 truncates a string parameter at 100 characters.

S4 — `error_reference` carries the stable code the walker sees translated on screen
(`mapFailed`, `styleRequestFailed`, …), and the discriminating detail travels in the
bounded message.

S5 — No URL query string or fragment leaves the device: a tile URL may carry a signed
query, and the map center may be the walker's own position.

S6 — A web load that never reports `load` and never reports `error` becomes `mapFailed`
after a fixed timeout, so a stalled worker or style is reportable instead of silent.

S7 — The console log of a failure names `sourceId`, the tile URL, the HTTP status and the
stage, and the WebGL context loss stops being the one silent path.

S8 — The native waits report too. Quoted decision: _"meterlo en esta rama"_ — the native
renderer's archive and style waits reach analytics with the same episode discipline as the
web renderer, instead of leaving a native map that cannot draw invisible.

S9 — What does not report yet is named rather than implied. The native draw stage (a
MapLibre error event, a context loss, an init throw, a load deadline) stays open: the
native canvas exposes no error callback, so closing it is its own slice.

## Tasks

| ID  | Spec   | Route  | Commit                                                               |
| --- | ------ | ------ | -------------------------------------------------------------------- |
| T1  | S2–S5  | inline | `feat(mobile): report map failures to analytics once per episode`    |
| T2  | S2, S7 | inline | `feat(mobile): name what failed and fail a web map that never loads` |
| T3  | S6     | inline | `feat(mobile): name what failed and fail a web map that never loads` |
| T4  | S8     | worker | uncommitted: the native waits report through the same episode funnel |
| T5  | S9     | open   | the native draw stage, its own slice                                 |

## Log

L1 (verbatim): _"no puedo pedirle eso al cleinte, que cmbios podemos hacer para logear el error y verlo en analytics?"_

L2 (verbatim): _"porqiue no agregar todos los logs?"_ — answered by separating the two
sinks: full console record, bounded analytics summary.

L3 (verbatim): _"ok"_ — authorizes the proposed scope: full console log with throttle,
one event per episode with the discriminating fields, and the web load timeout.

L4 (evidence): Firebase environment variables are wired for the staging web build
(`.github/workflows/deploy-mobile-web-staging.yml:45-51`), so a report actually leaves the
app. Had they been missing, `ensureWebInitialized` would fall back to `logger.info`, which
production suppresses (`packages/shared/src/utils/logger.ts:12-14`).

L5 (evidence): no module under `apps/mobile/src/components/map/` calls
`AnalyticsService`. Web failures reach `logger.error` only
(`use-web-map-instance.ts:252`, `:295`), and the context-loss handler logs nothing
(`:268`).

L6 (defect found in review, fixed before merge): the deadline as first written reported a
`timeout` twenty seconds after an error had already failed the build — a second, false
cause on top of the real one. Every path that fails a build now goes through one
`failOnce`, which also clears the deadline, and
`__tests__/use-web-map-instance-failure.test.tsx` pins it by asserting a single report.
The file was `use-web-map-instance-context-loss.test.tsx` until it started covering the
deadline and the reports as well.

L7 (defects found by independent verification of the whole diff, corrected before merge):

- The draw-stage report named no cause at all. A worker that never loads arrives as an
  `ErrorEvent` with no `sourceId` and no `tile`, and the handler dropped
  `event.error.message`, so the event read `map mapFailed draw` — the exact defect this
  feature exists to remove. The exception's sentence now travels in `message`.
- `event.tile.url` does not exist: MapLibre's `Tile` has no `url`, and a failed request is
  an `AJAXError` carrying `.status` and `.url` on the error itself. The url and the status
  were therefore always null; both are now read from the error.
- A `load` later than the deadline left `mapErrorCode` set, and `load` waits for tiles and
  the sprite, so a slow but working map stayed behind a "map failed" card forever. That
  was a regression this feature introduced; `load` now withdraws the failure and the
  report stays as the record the deadline made.
- `redactUrl` kept userinfo in the authority and a URL inside an exception message was
  appended unredacted, so a signed URL could reach a third party. Both are closed, and the
  case list in `__tests__/report-map-failure.test.ts` pins them.

L8 (scope, closed by decision): the native renderer resolves its archive and style through
`use-map-archive-file` and `useRemoteStyle` and never called `reportMapFailure`, so a
native map that could not draw was invisible. Verification showed the premise that
`use-map-source` served both renderers was false. The native waits now report through one
`useEffect` in `ExperienceMap`, placed after `failure` is computed and before the early
return, with the vocabulary widened in `map-view.types.ts` so the reporter accepts the
native codes without importing a renderer.

L9 (verbatim, the decision that put native in this branch): _"meterlo en esta rama"_. What
the native report cannot say yet, recorded rather than smoothed over: it carries no
`sourceId` and no exception sentence, because neither the archive hook's state nor the
style outcome keeps one, and its draw stage reports nothing at all (S9, T5).

L10 (the style status, native): `StyleOutcome` could not take a `status` field — that name
is the union's own discriminant — so the answer travels as `httpStatus`, the same name the
report detail uses. An offline rejection carries none, and absent is the honest answer
there.
