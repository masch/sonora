import { act, renderHook } from '@testing-library/react-native';

/**
 * The lost WebGL context, driven through the hook that owns the map instance: a helper
 * unit test cannot prove that this build calls it on the canvas its own instance owns.
 * Each query hands out a **fresh** canvas that records a handler only for the exact
 * event, so watching nothing, the wrong element, or the wrong event fails here.
 */
// The hook's module registers an archive protocol on import; no archive is downloaded here.
jest.mock('pmtiles', () => ({ PMTiles: class {} }));
// A failure the map survives is only a log line, and that is all a suite can see of it.
jest.mock('@/utils/logger', () => ({ logger: { error: jest.fn() } }));
// What the report does with its fields is the reporter's own suite: here it is the
// assertion, because a failure nobody can read from the outside is the whole defect.
jest.mock('@/services/analytics', () => ({ AnalyticsService: { recordError: jest.fn() } }));

import {
  WEB_LOAD_TIMEOUT_MS,
  useWebMapInstance,
  type WebMapInstanceOptions,
} from '@/components/map/use-web-map-instance';
import { resetReportedMapFailures } from '@/components/map/report-map-failure';
import { AnalyticsService } from '@/services/analytics';
import { mockMapInstances } from '@/test-utils/fake-maplibre';
import { logger } from '@/utils/logger';

const recordError = jest.mocked(AnalyticsService.recordError);

const ARCHIVE = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
/** The handler each canvas was given, in creation order: one per map instance. */
const watched: ((() => void) | null)[] = [];

/**
 * The node MapLibre draws into; a fresh canvas per query, recording only the loss event.
 *
 * `connected` is the document's own answer, and the one the hook reads before it
 * withdraws a failure: a failure surface replaces the map and unmounts its container, so
 * a late `load` can land on a node nobody renders.
 */
const freshContainer = (connected = true) =>
  ({
    isConnected: connected,
    querySelector: (selector: string) => {
      if (selector !== 'canvas') return null;
      const slot = watched.push(null) - 1;
      return {
        addEventListener: (event: string, handler: () => void) => {
          if (event === 'webglcontextlost') watched[slot] = handler;
        },
      };
    },
  }) as unknown as HTMLDivElement;

/** Delivers a change the way the browser would. */
const run = (fn: () => void) => act(async () => fn());

/** Fires the loss the hook must have registered, failing loudly when it did not. */
const loseContext = (index: number): void => {
  expect(watched[index]).toBeDefined();
  expect(watched[index]).not.toBeNull();
  watched[index]?.();
};

/** The options a renderer hands the hook; re-spread on a retry so `attempt` alone rebuilds. */
const mapInstanceOptions = (attempt = 0, connected = true): WebMapInstanceOptions => ({
  containerRef: { current: freshContainer(connected) },
  source: {},
  archive: { status: 'ready', sourceUrl: ARCHIVE },
  noRegion: true, // the reference plane: no archive is downloaded, the map builds at once
  center: [-64.738, -32.212],
  zoom: 12,
  attempt,
  glyphsAvailableRef: { current: false },
  applyOverlays: jest.fn(),
  openReference: jest.fn(),
});

/**
 * A request that failed, in the shape MapLibre hands the map.
 *
 * `AJAXError` is the response failure itself: the status and the url live on the error,
 * never on the event, whose `tile` is the library's internal instance with no url at all.
 */
const ajaxError = (status: number, url: string): Error =>
  Object.assign(new Error(`AJAXError: Not Found (${status}): ${url}`), { status, url });

// `renderHook` is asynchronous here: not awaiting it reads `result.current` too early.
const renderMapInstance = (options: WebMapInstanceOptions) =>
  renderHook((props: WebMapInstanceOptions) => useWebMapInstance(props), { initialProps: options });

describe('useWebMapInstance failure reporting', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    watched.length = 0;
    jest.mocked(logger.error).mockClear();
    // The episode registry belongs to a page session, and each case mounts its own.
    resetReportedMapFailures();
    recordError.mockClear();
  });

  it('fails a drawn map when the canvas it drew with loses its context', async () => {
    // A GPU reset leaves a map that reports nothing and draws nothing, and a post-load
    // `error` is treated as recoverable: the canvas is the only signal.
    const { result } = await renderMapInstance(mapInstanceOptions());
    await run(() => mockMapInstances[0].emit('load'));
    expect(result.current.mapErrorCode).toBeNull();
    await run(() => loseContext(0));
    expect(result.current.mapErrorCode).toBe('mapFailed');
    // Replacing the instance is the renderer's job: the retry stays a single map.
    expect(mockMapInstances).toHaveLength(1);
  });

  it('watches the new canvas when the failure is withdrawn and the map is rebuilt', async () => {
    // Watching the container once, or keeping the dead map's canvas, leaves the
    // replacement blind: correct-looking, and dead the same way one reset later.
    const options = mapInstanceOptions();
    const { result, rerender } = await renderMapInstance(options);
    await run(() => mockMapInstances[0].emit('load'));
    await run(() => loseContext(0));
    await run(() => result.current.setMapErrorCode(null));
    // The renderer keeps the same div and callbacks: only the build changes.
    await rerender({ ...options, attempt: 1 });
    expect(result.current.mapErrorCode).toBeNull();
    expect(mockMapInstances).toHaveLength(2);
    // One canvas per instance: the second map was built and watched on its own.
    expect(watched).toHaveLength(2);
    await run(() => loseContext(1));
    expect(result.current.mapErrorCode).toBe('mapFailed');
  });

  it('keeps a drawn map through a recoverable error, and logs it', async () => {
    // A sprite that 404s carries no fatal flag: a map that already drew keeps drawing,
    // and what the walker cannot see is still reported.
    const { result } = await renderMapInstance(mapInstanceOptions());
    const map = mockMapInstances[0];
    await run(() => map.emit('load'));
    const recoverable = new Error('sprite not found');
    await run(() => map.emit('error', { error: recoverable }));
    expect(result.current.mapErrorCode).toBeNull();
    expect(mockMapInstances).toHaveLength(1);
    // The source is the field that names which layer failed: without it the line says
    // only that something in the map did.
    expect(logger.error).toHaveBeenCalledWith('ExperienceMap error:', recoverable, {
      sourceId: null,
      url: null,
    });
  });

  it('reports a tile that 404s with its status, its source and a redacted url', async () => {
    // The report has to reach a dashboard without the walker: the code alone cannot
    // tell a worker served as the SPA fallback apart from a tile that 404s. The status
    // and the url live on the error, and the url's signed query stays on the device.
    const { result } = await renderMapInstance(mapInstanceOptions());
    const map = mockMapInstances[0];
    await run(() =>
      map.emit('error', {
        error: ajaxError(404, 'sonora://calamuchita/12/1/2.pbf?token=s3cr3t'),
        sourceId: 'basemap',
      }),
    );
    expect(result.current.mapErrorCode).toBe('mapFailed');
    expect(recordError).toHaveBeenCalledTimes(1);
    const [error, description, context] = recordError.mock.calls[0];
    expect((error as Error).message).toContain('draw');
    expect(description).toContain('404');
    expect(description).toContain('sonora://calamuchita/12/1/2.pbf');
    expect(description).not.toContain('s3cr3t');
    expect(description).toContain('source=basemap');
    expect(context).toEqual({ reference: 'mapFailed' });
    // One failing basemap emits an error per tile: the episode is already reported.
    await run(() =>
      map.emit('error', {
        error: ajaxError(404, 'sonora://calamuchita/12/3/4.pbf?token=s3cr3t'),
        sourceId: 'basemap',
      }),
    );
    expect(recordError).toHaveBeenCalledTimes(1);
  });

  it('names the cause of a worker that never loaded', async () => {
    // This is the failure that reaches the dashboard as `map mapFailed draw` and nothing
    // else: it carries no source and no tile, so the sentence is the only thing that
    // tells a worker served as the SPA fallback apart from any other map that never drew.
    const { result } = await renderMapInstance(mapInstanceOptions());
    await run(() =>
      mockMapInstances[0].emit('error', {
        error: new Error('Worker failed to load. Check that the worker URL is correct.'),
      }),
    );
    expect(result.current.mapErrorCode).toBe('mapFailed');
    expect(recordError).toHaveBeenCalledTimes(1);
    const [, description] = recordError.mock.calls[0];
    expect(description).toContain('draw');
    expect(description).toContain('Worker failed to load');
  });

  it('reports a lost context, which used to be the one silent failure', async () => {
    const { result } = await renderMapInstance(mapInstanceOptions());
    await run(() => mockMapInstances[0].emit('load'));
    await run(() => loseContext(0));
    expect(result.current.mapErrorCode).toBe('mapFailed');
    expect(recordError).toHaveBeenCalledTimes(1);
    const [, description, context] = recordError.mock.calls[0];
    expect(description).toContain('contextLost');
    expect(context).toEqual({ reference: 'mapFailed' });
  });

  it('fails a map that neither loads nor errors, instead of waiting forever', async () => {
    // A style or a worker that never answers throws nothing: without a deadline the
    // card spins, nothing is reported, and the report we added never runs.
    jest.useFakeTimers();
    try {
      const { result } = await renderMapInstance(mapInstanceOptions());
      expect(result.current.mapErrorCode).toBeNull();
      await run(() => jest.advanceTimersByTime(WEB_LOAD_TIMEOUT_MS));
      expect(result.current.mapErrorCode).toBe('mapFailed');
      expect(recordError).toHaveBeenCalledTimes(1);
      const [, description, context] = recordError.mock.calls[0];
      expect(description).toContain('timeout');
      expect(context).toEqual({ reference: 'mapFailed' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not add a timeout to a build that has already failed', async () => {
    // The deadline must not contradict an answer the build already gave: a second, false
    // cause twenty seconds later buries the real one and sends the reader to the wrong
    // place.
    jest.useFakeTimers();
    try {
      const { result } = await renderMapInstance(mapInstanceOptions());
      await run(() =>
        mockMapInstances[0].emit('error', { error: new Error('Worker failed to load') }),
      );
      expect(recordError).toHaveBeenCalledTimes(1);
      await run(() => jest.advanceTimersByTime(WEB_LOAD_TIMEOUT_MS));
      expect(recordError).toHaveBeenCalledTimes(1);
      expect(String(recordError.mock.calls[0][1])).not.toContain('timeout');
      expect(result.current.mapErrorCode).toBe('mapFailed');
    } finally {
      jest.useRealTimers();
    }
  });

  it('withdraws the deadline failure when the map draws late', async () => {
    // `load` waits for tiles and the sprite, so a working map can pass the deadline and
    // load afterwards. Keeping the code would leave a "map failed" card over a map that
    // draws, forever; the report stays as the record the deadline made.
    jest.useFakeTimers();
    try {
      const { result } = await renderMapInstance(mapInstanceOptions());
      await run(() => jest.advanceTimersByTime(WEB_LOAD_TIMEOUT_MS));
      expect(result.current.mapErrorCode).toBe('mapFailed');
      expect(recordError).toHaveBeenCalledTimes(1);
      await run(() => mockMapInstances[0].emit('load'));
      expect(result.current.mapErrorCode).toBeNull();
      expect(recordError).toHaveBeenCalledTimes(1);
      expect(String(recordError.mock.calls[0][1])).toContain('timeout');
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the failure when a late load lands on a container the error surface unmounted', async () => {
    // The failure card replaced the map, so its container is unmounted and the instance
    // keeps drawing into a detached node. Withdrawing the failure there would re-render
    // an empty container over a map bound to the old node; the retry is what rebuilds it.
    jest.useFakeTimers();
    try {
      const { result } = await renderMapInstance(mapInstanceOptions(0, false));
      await run(() => jest.advanceTimersByTime(WEB_LOAD_TIMEOUT_MS));
      expect(result.current.mapErrorCode).toBe('mapFailed');
      await run(() => mockMapInstances[0].emit('load'));
      expect(result.current.mapErrorCode).toBe('mapFailed');
      expect(recordError).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('withdraws a late load’s failure while the container is still in the document', async () => {
    // The other half of the same rule: a container the renderer still draws into is a map
    // that recovered, and the card has to go with the failure it was showing.
    jest.useFakeTimers();
    try {
      const { result } = await renderMapInstance(mapInstanceOptions(0, true));
      await run(() => jest.advanceTimersByTime(WEB_LOAD_TIMEOUT_MS));
      expect(result.current.mapErrorCode).toBe('mapFailed');
      await run(() => mockMapInstances[0].emit('load'));
      expect(result.current.mapErrorCode).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('still fails a map that reports an error before it ever drew', async () => {
    // The order is the only honest test `error` allows: before `load` there is nothing
    // on screen to keep, so this is a failure to draw.
    const { result } = await renderMapInstance(mapInstanceOptions());
    await run(() => mockMapInstances[0].emit('error', { error: new Error('style rejected') }));
    expect(result.current.mapErrorCode).toBe('mapFailed');
    expect(mockMapInstances).toHaveLength(1);
  });

  it('still fails the map when it loses its context after a withdrawn deadline', async () => {
    // A late `load` withdraws the deadline failure, but the loss that follows is a real
    // failure that still holds: the canvas is blank and only this signal says so. Holding
    // the whole failure back because a report was already sent leaves that map dead with
    // no card and no retry.
    jest.useFakeTimers();
    try {
      const { result } = await renderMapInstance(mapInstanceOptions());
      await run(() => jest.advanceTimersByTime(WEB_LOAD_TIMEOUT_MS));
      await run(() => mockMapInstances[0].emit('load'));
      expect(result.current.mapErrorCode).toBeNull();
      await run(() => loseContext(0));
      expect(result.current.mapErrorCode).toBe('mapFailed');
      // The lost context is its own episode, and it names itself.
      expect(String(recordError.mock.calls[recordError.mock.calls.length - 1][1])).toContain(
        'contextLost',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('still fails the map when a drawn map loses its context after a recoverable error', async () => {
    const { result } = await renderMapInstance(mapInstanceOptions());
    const map = mockMapInstances[0];
    await run(() => map.emit('error', { error: ajaxError(404, 'https://t.example/1.pbf') }));
    await run(() => map.emit('load'));
    expect(result.current.mapErrorCode).toBeNull();
    await run(() => loseContext(0));
    expect(result.current.mapErrorCode).toBe('mapFailed');
  });
});
