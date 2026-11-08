import { AnalyticsService } from '@/services/analytics';

import type { MapReportedErrorCode } from './map-view.types';

/**
 * The one place a map failure becomes a report we can read from the outside.
 *
 * Why it exists: a map that cannot draw is visible to the walker and invisible to us.
 * Every renderer logged its failure to a console nobody can open on someone else's
 * phone, and no module under `components/map/` ever reached `AnalyticsService` — so a
 * staging build that could not draw reached us as a screenshot and nothing else.
 *
 * Why the report is bounded and deduplicated: the two sinks are not the same. The
 * console keeps every event, with the detail the request layer produced. Analytics is a
 * channel with silent limits — GA4 truncates a string parameter at 100 characters, and
 * Crashlytics keeps only the most recent eight non-fatal exceptions of a session — while
 * MapLibre emits `error` once per failing tile. Reporting each event would spend those
 * eight slots on one broken basemap and hide the crash we were looking for.
 */
export type MapFailureStage = 'archive' | 'style' | 'draw' | 'contextLost' | 'timeout';

/**
 * What the failure looked like when it happened.
 *
 * `url` is the document or asset that failed, `httpStatus` the answer a server gave,
 * `sourceId` the MapLibre source — the three fields that tell a worker served as an SPA
 * fallback apart from a 404 artefact, which without them are both only `mapFailed`.
 */
export interface MapFailureDetail {
  stage: MapFailureStage;
  url?: string | null;
  httpStatus?: number | null;
  sourceId?: string | null;
  /**
   * What the exception itself said, when there was one.
   *
   * A map that never got created fails with no url and no status — "Worker failed to
   * load", "WebGL context not supported" — and that sentence is the only thing that
   * tells those causes apart, so it travels with the report instead of dying in the
   * console the walker cannot open.
   */
  message?: string | null;
}

/**
 * The length GA4 accepts for a string parameter value.
 *
 * Past it the value is truncated at collection time with no error, which for a report is
 * the same as never having sent the field.
 */
export const MAX_MAP_FAILURE_MESSAGE = 100;

/**
 * How many episode keys are remembered.
 *
 * A page lives long enough to fail many times — every retry is an episode — and this
 * only has to catch the repeats of one episode, never the history of the session.
 */
const MAX_REPORTED_EPISODES = 20;

/** The episodes already reported, oldest first. */
const reported: string[] = [];

/**
 * Forgets every reported episode.
 *
 * The registry is scoped to one page session: a suite mounts many pages, and each one
 * starts not having reported anything.
 */
export function resetReportedMapFailures(): void {
  reported.length = 0;
}

/**
 * A url without the parts that are not the document's name.
 *
 * A tile url can carry a signed query, a style url carrying the map center would be the
 * walker's own position, and an authority can carry credentials: none of the three
 * belongs in a third-party dashboard. The cut falls on the literal separators only: a
 * percent-encoded one (`%3F`) is a character of the path and cutting there would name a
 * different document than the one that failed.
 */
export function redactUrl(url?: string | null): string | null {
  if (!url) return null;
  const cut = url.search(/[?#]/);
  const named = cut === -1 ? url : url.slice(0, cut);
  // `https://user:secret@example.test/x` names `example.test` and nothing else: the
  // credentials in the authority are who asked, not what failed.
  return named.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, '$1');
}

/**
 * Every url in a sentence, with the parts that must not travel cut off.
 *
 * MapLibre's own failure sentence embeds the request it made
 * (`AJAXError: Not Found (404): <url>`), so an exception carrying a signed tile url, or
 * credentials, would otherwise be the way both leave the device: inside text nobody
 * thought to redact because it is not the url field.
 */
function redactUrlsIn(text: string): string {
  return text.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (found) => redactUrl(found) ?? '');
}

/**
 * A coordinate pair, which is the walker's own position when it is the map's centre.
 *
 * MapLibre refuses an invalid camera with `Invalid LngLat object: (-64.738, -32.212)`,
 * and that sentence travels with the report: how many decimals it had is never what
 * diagnoses a failure, only that a coordinate was there.
 */
const COORDINATE_PAIR = /[-+]?\d{1,3}\.\d{3,},\s*[-+]?\d{1,3}\.\d{3,}/g;

/** Everything a detail may carry that must not leave the device. */
function sanitize(text: string): string {
  return redactUrlsIn(text).replace(COORDINATE_PAIR, '<coords>');
}

/**
 * The identity of one failure episode.
 *
 * Built from what discriminates a cause, not from what varies within it: two tiles of
 * one broken source are the same failure, and an error with neither source nor url is
 * one failure per stage. A different code is always a different episode.
 */
function episodeKey(code: MapReportedErrorCode, detail: MapFailureDetail): string {
  return [
    code,
    detail.stage,
    detail.httpStatus ?? '',
    redactUrl(detail.url) ?? '',
    detail.sourceId ?? '',
    // A different sentence is a different failure — one worker that did not load is not
    // the same episode as one WebGL context the browser refused to create. Redacted, so
    // two tiles of one source stay one episode although each signature differs.
    sanitize(detail.message ?? '').slice(0, 60),
  ].join('|');
}

/**
 * The description a report carries, ordered so truncation costs the least.
 *
 * The stable code and the stage come first because they are what the report is for; the
 * url comes before the source id because it is the field that names a cause, and a long
 * source id is the field we can afford to lose to the 100-character limit. The
 * exception's own sentence comes last, for the same reason — and redacted, because a
 * sentence may carry a url the field above would have redacted.
 */
function describeFailure(code: MapReportedErrorCode, detail: MapFailureDetail): string {
  const parts = ['map', code, detail.stage];
  if (detail.httpStatus !== undefined && detail.httpStatus !== null) {
    parts.push(String(detail.httpStatus));
  }
  const url = redactUrl(detail.url);
  if (url) parts.push(url);
  if (detail.sourceId) parts.push(`source=${detail.sourceId}`);
  if (detail.message) parts.push(sanitize(detail.message));
  return parts.join(' ').slice(0, MAX_MAP_FAILURE_MESSAGE);
}

/**
 * Reports one map failure, once per episode.
 *
 * `reference` is the stable code the walker sees translated on screen, so a report read
 * on the dashboard and a screenshot read on a phone name the same failure; the detail
 * travels in the bounded description instead of inventing a dimension per cause.
 */
export function reportMapFailure(code: MapReportedErrorCode, detail: MapFailureDetail): void {
  const key = episodeKey(code, detail);
  if (reported.includes(key)) return;

  reported.push(key);
  if (reported.length > MAX_REPORTED_EPISODES) reported.shift();

  const description = describeFailure(code, detail);
  AnalyticsService.recordError(new Error(description), description, { reference: code });
}
