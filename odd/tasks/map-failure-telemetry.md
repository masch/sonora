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

## Tasks

| ID  | Spec   | Route  | Commit                                                               |
| --- | ------ | ------ | -------------------------------------------------------------------- |
| T1  | S2–S5  | inline | `feat(mobile): report map failures to analytics once per episode`    |
| T2  | S2, S7 | inline | `feat(mobile): name what failed and fail a web map that never loads` |
| T3  | S6     | inline | `feat(mobile): name what failed and fail a web map that never loads` |

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
