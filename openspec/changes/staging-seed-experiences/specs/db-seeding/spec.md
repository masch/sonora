# db-seeding Specification

## Purpose

Seeding is environment-isolated: a base entry (`seed.ts`) and a staging entry (`seed-staging.ts`) share base data from `seed-data.ts` by composition, so staging-only test experiences can never reach production.

## Requirements

### Requirement: Environment-Isolated Seed Entries

The system MUST provide three seed modules: `seed-data.ts` (base themes/experiences/waypoints moved verbatim from today's `seed.ts`), `seed.ts` (imports base only), and `seed-staging.ts` (imports base plus `stagingOnly*` arrays). Staging-only data MUST NOT be referenced from `seed.ts`.

#### Scenario: Composition without duplication

- GIVEN base data in `seed-data.ts` and staging arrays in `seed-staging.ts`
- WHEN the staging entry runs
- THEN base + staging experiences are seeded
- AND each is defined exactly once across files

#### Scenario: Prod path has no staging data

- GIVEN `seed.ts` sources
- WHEN inspected
- THEN it contains no reference to any `stagingOnly*` symbol

### Requirement: Fail-Closed SEED_ENV Guard

`seed-staging.ts` MUST exit non-zero (before any write) unless `SEED_ENV === 'staging'`. `seed.ts` MUST exit non-zero when `SEED_ENV` is present and `!== 'production'`; absent `SEED_ENV` (local/dev) SHALL remain permitted for the base entry.

#### Scenario: Staging entry refuses wrong env

- GIVEN `SEED_ENV` unset or not `staging`
- WHEN `seed-staging.ts` starts
- THEN it exits non-zero with an error message
- AND no rows are written

#### Scenario: Base entry refuses staging env

- GIVEN `SEED_ENV=staging`
- WHEN `seed.ts` starts
- THEN it exits non-zero
- AND no rows are written

### Requirement: Staging Test Data Contract

Staging-only experiences MUST have `[PRUEBA]`-prefixed titles, stable hardcoded UUIDs (never `defaultRandom`), and unique slugs not colliding with base slugs. The set MUST be a stable fixed list (changed only via PR). Variant matrix MUST cover every schema-supported combination (format × free/audio/paid × geofence × published):

| format           | free/audio/paid                       | geofence   | published  |
| ---------------- | ------------------------------------- | ---------- | ---------- |
| track            | free+audio / free+noaudio / paid(ARS) | true,false | true,false |
| trip             | free+audio / free+noaudio / paid(ARS) | true,false | true,false |
| general-feedback | free, no audio                        | true,false | true,false |

#### Scenario: Matrix coverage

- GIVEN a seeded staging DB
- WHEN querying experiences by title prefix `[PRUEBA]`
- THEN every matrix combination has exactly one row

#### Scenario: Stable identity across re-runs

- GIVEN the staging seed runs twice
- WHEN comparing rows
- THEN UUIDs, slugs, and titles are identical between runs

### Requirement: Waypoint Delete Scope

The staging entry MUST delete+reinsert waypoints for the union of base + staging experience IDs. It MUST NOT delete waypoints of non-seeded experiences.

#### Scenario: Union-scoped replacement

- GIVEN base and staging experiences with waypoints
- WHEN the staging entry runs
- THEN waypoints are replaced for all seeded IDs (base + staging)
- AND waypoints of other experiences are untouched

### Requirement: Staging Media Keys

Staging experiences with `published: true` and a non-null `audioUrl` MUST reference audio keys present in the staging R2 private bucket (`sonora-staging-private-audio`). Audio binaries for those keys MUST be uploaded to the staging bucket as part of this change. Free no-audio variants MUST omit `audioUrl`. `imageKey` MUST reuse an existing `TRACK_IMAGE_KEYS` value (client fallback covers unknown keys, but keys MUST remain valid).

#### Scenario: Published audio resolves

- GIVEN a published staging experience with `audioUrl`
- WHEN its key is checked in the staging R2 bucket
- THEN the object exists
- AND streaming it returns 200 (not 404)

#### Scenario: Asset-free variant safe

- GIVEN a free general-feedback staging experience
- WHEN its record is inspected
- THEN `audioUrl` is null
- AND no R2 key is required for playback

### Requirement: Lint Integration

New seed files (`seed-data.ts`, `seed-staging.ts`) MUST be added to the `no-console` override list in `apps/api/eslint.config.js` so CI lint passes.

#### Scenario: Lint passes

- GIVEN the new seed files use `console` for progress output
- WHEN `make lint` runs
- THEN no `no-console` errors are reported for those files
