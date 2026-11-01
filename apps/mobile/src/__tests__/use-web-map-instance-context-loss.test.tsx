import { act, renderHook } from '@testing-library/react-native';

/**
 * The lost WebGL context, driven through the hook that owns the map instance.
 *
 * These are hook-level tests on purpose. A unit test of the exported helper proves what
 * the helper does; it cannot prove that `useWebMapInstance` calls it, on the canvas the
 * instance it just created owns, for the build that is currently on screen — and that
 * call is the whole correction. The container below hands out a **fresh** canvas per
 * query and records the handler only for the exact event name, so a hook that stopped
 * watching, watched the wrong element, or listened for the wrong event fails here.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the jest.mock factory is hoisted
jest.mock('maplibre-gl', () => require('@/test-utils/fake-maplibre').fakeMaplibreModule());

// The hook's module registers an archive protocol on import; no archive is downloaded here.
jest.mock('pmtiles', () => ({ PMTiles: class {} }));

// A recoverable failure is a log line: what a suite can see of an error the map survives.
jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  useWebMapInstance,
  type WebMapInstanceOptions,
} from '@/components/map/use-web-map-instance';
import { mockMapInstances } from '@/test-utils/fake-maplibre';
import { logger } from '@/utils/logger';

const ARCHIVE = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';

/** The logger, as jest sees it: a drawn map's error is reported and nothing more. */
const mockedLogger = logger as unknown as { error: jest.Mock };

/** One canvas the hook could have watched, and the handler it left there. */
interface FakeCanvas {
  /** The handler registered for the loss, or `null` when the hook watched another event. */
  lost: (() => void) | null;
  addEventListener: (event: string, handler: () => void) => void;
}

/**
 * Every canvas the container handed out, in creation order: one per map instance.
 *
 * The hook queries the canvas once, while building the map, so the list is also the
 * record of which builds were watched — a retry that never watched its own canvas shows
 * up here as a list that did not grow.
 */
const canvases: FakeCanvas[] = [];

/**
 * A canvas that records only the event the map's own signal is named.
 *
 * A double that accepted any event would let a wrong string pass: the handler would be
 * registered, the test would fire it, and the hook would look correct while following an
 * event the browser never sends.
 */
function pushFreshCanvas(): FakeCanvas {
  const canvas: FakeCanvas = {
    lost: null,
    addEventListener: (event, handler) => {
      if (event === 'webglcontextlost') canvas.lost = handler;
    },
  };
  canvases.push(canvas);
  return canvas;
}

/** The node MapLibre draws into. Only `canvas` exists inside it, as under test. */
function container() {
  return {
    querySelector: (selector: string) => (selector === 'canvas' ? pushFreshCanvas() : null),
  } as unknown as HTMLDivElement;
}

/** Fires the loss the hook must have registered, failing loudly when it did not. */
function loseContext(index: number): void {
  const canvas = canvases[index];
  expect(canvas).toBeDefined();
  expect(canvas.lost).not.toBeNull();
  canvas.lost?.();
}

/**
 * The options a renderer hands the hook.
 *
 * Built once per test and re-spread on a retry: the container and the callbacks keep their
 * identity, so the map is rebuilt by `attempt` alone instead of by a new function every
 * render. The div is stable across a retry in the renderer too — MapLibre replaces the
 * canvas inside it — which is exactly why the second build needs its own watch.
 */
function mapInstanceOptions(attempt = 0): WebMapInstanceOptions {
  return {
    containerRef: { current: container() },
    source: {},
    archive: { status: 'ready', sourceUrl: ARCHIVE },
    // The reference plane: no archive is downloaded, and the map is built immediately.
    noRegion: true,
    center: [-64.738, -32.212],
    zoom: 12,
    attempt,
    glyphsAvailableRef: { current: false },
    applyOverlays: jest.fn(),
    openReference: jest.fn(),
  };
}

function renderMapInstance(options: WebMapInstanceOptions) {
  // The renderer is async in this version of the library: the effects have run by the
  // time it resolves, so the map the hook built is already in `mockMapInstances`.
  return renderHook((props: WebMapInstanceOptions) => useWebMapInstance(props), {
    initialProps: options,
  });
}

describe('useWebMapInstance context loss', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    canvases.length = 0;
    mockedLogger.error.mockClear();
  });

  it('fails a drawn map when the canvas it drew with loses its context', async () => {
    // A GPU reset or a driver dropping the tab leaves a map that reports nothing and
    // draws nothing: every later frame is blank. The map has loaded, so the `error`
    // handler treats it as recoverable and stays quiet — the canvas is the only signal.
    const { result } = await renderMapInstance(mapInstanceOptions());
    const map = mockMapInstances[0];
    expect(result.current.mapErrorCode).toBeNull();

    await act(async () => {
      map.emit('load');
    });
    expect(result.current.mapErrorCode).toBeNull();

    await act(async () => {
      loseContext(0);
    });

    expect(result.current.mapErrorCode).toBe('mapFailed');
    // The hook reports the failure; replacing the instance is the renderer's job, which
    // is what keeps the retry a single map the walker can watch being rebuilt.
    expect(mockMapInstances).toHaveLength(1);
  });

  it('watches the new canvas when the failure is withdrawn and the map is rebuilt', async () => {
    // The retry builds a second instance with its own canvas. A hook that watched the
    // container once — or kept the canvas of the dead map — would leave the replacement
    // blind: correct-looking, and dead the same silent way one GPU reset later.
    const options = mapInstanceOptions();
    const { result, rerender } = await renderMapInstance(options);

    await act(async () => {
      mockMapInstances[0].emit('load');
    });
    await act(async () => {
      loseContext(0);
    });
    expect(result.current.mapErrorCode).toBe('mapFailed');

    await act(async () => {
      result.current.setMapErrorCode(null);
    });
    // The renderer keeps the same div and the same callbacks: only the build changes.
    await rerender({ ...options, attempt: 1 });

    expect(result.current.mapErrorCode).toBeNull();
    expect(mockMapInstances).toHaveLength(2);
    // One canvas per instance: the second map was built and watched on its own.
    expect(canvases).toHaveLength(2);

    await act(async () => {
      loseContext(1);
    });

    expect(result.current.mapErrorCode).toBe('mapFailed');
  });

  it('keeps a drawn map through a recoverable error, and logs it', async () => {
    // MapLibre emits `error` for failures a working map survives — a sprite that 404s, a
    // layer whose source never arrived. The event carries no fatal flag and the same
    // fields appear on both kinds, so the map that already drew keeps drawing.
    const { result } = await renderMapInstance(mapInstanceOptions());
    const map = mockMapInstances[0];

    await act(async () => {
      map.emit('load');
    });

    const recoverable = new Error('sprite not found');
    await act(async () => {
      map.emit('error', { error: recoverable });
    });

    expect(result.current.mapErrorCode).toBeNull();
    expect(mockMapInstances).toHaveLength(1);
    // What the walker cannot see is still reported, with the library's own error.
    expect(mockedLogger.error).toHaveBeenCalledWith('ExperienceMap error:', recoverable);
  });

  it('still fails a map that reports an error before it ever drew', async () => {
    // The order is the only honest test the `error` event allows: before `load` there is
    // nothing on screen to keep, so this is a failure to draw and the screen says so.
    const { result } = await renderMapInstance(mapInstanceOptions());

    await act(async () => {
      mockMapInstances[0].emit('error', { error: new Error('style rejected') });
    });

    expect(result.current.mapErrorCode).toBe('mapFailed');
    expect(mockMapInstances).toHaveLength(1);
  });
});
