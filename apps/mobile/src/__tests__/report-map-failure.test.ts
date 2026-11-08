/**
 * The one place a map failure becomes an analytics report.
 *
 * These suites drive the report shape, not the transport: `AnalyticsService` is the
 * contract every renderer shares, and what reaches Firebase or Crashlytics is that
 * module's own business.
 */
jest.mock('@/services/analytics', () => ({
  AnalyticsService: { recordError: jest.fn() },
}));

import {
  MAX_MAP_FAILURE_MESSAGE,
  redactUrl,
  reportMapFailure,
  resetReportedMapFailures,
} from '@/components/map/report-map-failure';
import { AnalyticsService } from '@/services/analytics';

const recordError = jest.mocked(AnalyticsService.recordError);

/** The description a report carried, which is where the detail travels. */
const descriptionOf = (call: number): string => String(recordError.mock.calls[call][1]);
/** The context a report carried, which is where the stable code travels. */
const contextOf = (call: number): { reference?: string } =>
  recordError.mock.calls[call][2] as { reference?: string };

describe('reportMapFailure', () => {
  beforeEach(() => {
    // The episode registry belongs to a page session, and each case is its own page.
    resetReportedMapFailures();
    recordError.mockClear();
  });

  it('reports one episode once, however many events the library emits', () => {
    // MapLibre emits `error` once per failing tile: a report per event would spend the
    // eight non-fatal slots Crashlytics keeps per session on one broken basemap.
    reportMapFailure('mapFailed', { stage: 'draw', sourceId: 'basemap' });
    reportMapFailure('mapFailed', { stage: 'draw', sourceId: 'basemap' });
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('reports a different failure as its own episode', () => {
    // Two causes are two facts: deduplicating across codes would hide the second one.
    reportMapFailure('mapFailed', { stage: 'draw' });
    reportMapFailure('styleRequestFailed', { stage: 'style' });
    expect(recordError).toHaveBeenCalledTimes(2);
  });

  it('carries the stable code as the reference the dashboard groups by', () => {
    // The reference has to be short and stable, or every failure invents a dimension
    // and the dashboard stops grouping.
    reportMapFailure('styleInvalid', { stage: 'style' });
    expect(contextOf(0).reference).toBe('styleInvalid');
  });

  it('names the stage, the status and the url in the description', () => {
    // These are the fields that tell a worker served as an SPA fallback apart from a
    // 404 artefact: without them every cause reaches the dashboard as `mapFailed`.
    reportMapFailure('mapFailed', {
      stage: 'draw',
      httpStatus: 200,
      url: 'https://example.test/maplibre-gl-worker.js',
    });
    expect(descriptionOf(0)).toBe(
      'map mapFailed draw 200 https://example.test/maplibre-gl-worker.js',
    );
  });

  it('drops the query string and the fragment of every url it reports', () => {
    // A tile url may carry a signed query, and the map center is the walker's position:
    // a third party is not where either belongs.
    reportMapFailure('mapFailed', {
      stage: 'draw',
      url: 'https://example.test/style.json?token=secret#zoom=12',
    });
    expect(descriptionOf(0)).not.toContain('secret');
    expect(descriptionOf(0)).not.toContain('zoom=12');
    expect(descriptionOf(0)).toContain('https://example.test/style.json');
  });

  it('bounds the description so Firebase does not truncate it silently', () => {
    // A parameter value over 100 characters is dropped by GA4 without a word.
    reportMapFailure('mapFailed', {
      stage: 'draw',
      url: `https://example.test/${'a'.repeat(200)}.json`,
    });
    expect(descriptionOf(0).length).toBeLessThanOrEqual(MAX_MAP_FAILURE_MESSAGE);
  });

  it('carries what the exception said, for the failure that has no url at all', () => {
    // A map that never got created fails with a sentence and nothing else: it is the
    // only field that tells a worker that did not load from a missing WebGL context.
    reportMapFailure('mapFailed', { stage: 'draw', message: 'Worker failed to load' });
    expect(descriptionOf(0)).toBe('map mapFailed draw Worker failed to load');
  });
});

describe('redactUrl', () => {
  it('keeps the path and removes what travels with it', () => {
    expect(redactUrl('https://example.test/a/b.json?x=1#y')).toBe('https://example.test/a/b.json');
  });

  it('hands back nothing for a missing url', () => {
    expect(redactUrl(undefined)).toBeNull();
    expect(redactUrl(null)).toBeNull();
    expect(redactUrl('')).toBeNull();
  });
});
