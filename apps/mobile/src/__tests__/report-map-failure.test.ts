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

  it('keeps a coordinate out, because it is where the walker is', () => {
    // MapLibre refuses a bad camera with `Invalid LngLat object: (-64.738, -32.212)`, and
    // that sentence would otherwise travel with the report: how many decimals the camera
    // had never diagnoses a failure, only that a coordinate was in it.
    reportMapFailure('mapFailed', {
      stage: 'draw',
      message: 'Invalid LngLat object: (-64.738, -32.212)',
    });
    expect(descriptionOf(0)).not.toContain('-64.738');
    expect(descriptionOf(0)).not.toContain('-32.212');
    expect(descriptionOf(0)).toContain('<coords>');
  });

  it('redacts a url the sentence glues to prose, in any scheme', () => {
    // An exception message is the one field we do not build ourselves, so the redaction
    // cannot assume a space before the scheme or a lowercase one.
    reportMapFailure('mapFailed', {
      stage: 'draw',
      message: 'failed:https://t.example/1.pbf?token=s3cr3t',
    });
    reportMapFailure('mapFailed', {
      stage: 'draw',
      message: 'see HTTPS://t.example/1.pbf?token=s3cr3t',
    });
    expect(descriptionOf(0)).not.toContain('s3cr3t');
    expect(descriptionOf(1)).not.toContain('s3cr3t');
  });

  it('redacts every url an exception sentence carries', () => {
    // MapLibre's own failure sentence embeds the request it made, and a tile request can
    // carry a signed query and credentials: a sentence nobody thought to redact would
    // otherwise be the way both leave the device.
    reportMapFailure('mapFailed', {
      stage: 'draw',
      message:
        'AJAXError: Not Found (404): https://user:s3cr3t@example.test/tiles/1/2/3.pbf?token=s3cr3t',
    });
    expect(descriptionOf(0)).not.toContain('s3cr3t');
    expect(descriptionOf(0)).not.toContain('user:');
    expect(descriptionOf(0)).toContain('https://example.test/tiles/1/2/3.pbf');
  });
});

describe('redactUrl', () => {
  it('keeps the path and removes what travels with it', () => {
    expect(redactUrl('https://example.test/a/b.json?x=1#y')).toBe('https://example.test/a/b.json');
  });

  it('strips the credentials out of the authority', () => {
    // A signed url can carry userinfo, and a third-party dashboard is not where one
    // belongs: what it names is the host, not who asked.
    expect(redactUrl('https://user:s3cr3t@example.test/style.json?x=1#y')).toBe(
      'https://example.test/style.json',
    );
  });

  it('leaves a percent-encoded separator in the path alone', () => {
    // `%3F` is a character of the path, not the start of a query: cutting there would
    // name a different document than the one that failed.
    expect(redactUrl('https://example.test/a%3Fx%3D1')).toBe('https://example.test/a%3Fx%3D1');
  });

  it('hands back nothing for a missing url', () => {
    expect(redactUrl(undefined)).toBeNull();
    expect(redactUrl(null)).toBeNull();
    expect(redactUrl('')).toBeNull();
  });

  it('strips userinfo but keeps an @ that belongs to the path', () => {
    expect(redactUrl('https://user@example.test/x?q=1')).toBe('https://example.test/x');
    expect(redactUrl('HTTPS://user:pw@example.test/x?q=1')).toBe('HTTPS://example.test/x');
    expect(redactUrl('https://example.test/a@b/c.json?x=1#y')).toBe(
      'https://example.test/a@b/c.json',
    );
  });
});
