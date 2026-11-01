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

import {
  useWebMapInstance,
  type WebMapInstanceOptions,
} from '@/components/map/use-web-map-instance';
import { mockMapInstances } from '@/test-utils/fake-maplibre';
import { logger } from '@/utils/logger';

const ARCHIVE = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
/** The handler each canvas was given, in creation order: one per map instance. */
const watched: ((() => void) | null)[] = [];

/** The node MapLibre draws into; a fresh canvas per query, recording only the loss event. */
const freshContainer = () =>
  ({
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
const mapInstanceOptions = (attempt = 0): WebMapInstanceOptions => ({
  containerRef: { current: freshContainer() },
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

// `renderHook` is asynchronous here: not awaiting it reads `result.current` too early.
const renderMapInstance = (options: WebMapInstanceOptions) =>
  renderHook((props: WebMapInstanceOptions) => useWebMapInstance(props), { initialProps: options });

describe('useWebMapInstance context loss', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    watched.length = 0;
    jest.mocked(logger.error).mockClear();
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
    expect(logger.error).toHaveBeenCalledWith('ExperienceMap error:', recoverable);
  });

  it('still fails a map that reports an error before it ever drew', async () => {
    // The order is the only honest test `error` allows: before `load` there is nothing
    // on screen to keep, so this is a failure to draw.
    const { result } = await renderMapInstance(mapInstanceOptions());
    await run(() => mockMapInstances[0].emit('error', { error: new Error('style rejected') }));
    expect(result.current.mapErrorCode).toBe('mapFailed');
    expect(mockMapInstances).toHaveLength(1);
  });
});
