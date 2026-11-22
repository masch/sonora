import { renderHook, waitFor } from '@testing-library/react-native';

import { AnalyticsService } from '@/services/analytics';

import {
  useMapCapability,
  resetMeasuredUnsupportedBrowser,
} from '@/components/map/use-map-capability';

/**
 * The field profile: Safari 15.6.8 on iOS 15.8.8, the device class the reports
 * came from.
 */
const IOS_15_SAFARI_15 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.8 Mobile/15E148 Safari/604.1';

const IOS_17_SAFARI_17 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** The agent the runner started with, so a case that rewrites it cannot leak forward. */
const RUNNER_AGENT = globalThis.navigator.userAgent;

function setAgent(ua: string): void {
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

jest.mock('@/services/analytics', () => ({
  AnalyticsService: { recordError: jest.fn(), trackEvent: jest.fn() },
}));

describe('useMapCapability', () => {
  beforeEach(() => {
    jest.mocked(AnalyticsService.trackEvent).mockClear();
    jest.mocked(AnalyticsService.recordError).mockClear();
    resetMeasuredUnsupportedBrowser();
  });

  afterEach(() => {
    setAgent(RUNNER_AGENT);
  });

  it('measures the unsupported device once, with the OS its agent names', async () => {
    setAgent(IOS_15_SAFARI_15);

    const { result } = await renderHook(() => useMapCapability());

    expect(result.current.mapSupported).toBe(false);
    expect(result.current.osVersion).toBe('iOS 15.8.8');

    await waitFor(() =>
      expect(AnalyticsService.trackEvent).toHaveBeenCalledWith('map_unsupported_browser', {
        os_version: 'iOS 15.8.8',
      }),
    );
    // A condition, not a failure: the error channel is never touched.
    expect(AnalyticsService.recordError).not.toHaveBeenCalled();
  });

  it('measures nothing when the browser can draw the map', async () => {
    setAgent(IOS_17_SAFARI_17);

    const { result } = await renderHook(() => useMapCapability());

    expect(result.current.mapSupported).toBe(true);
    expect(result.current.osVersion).toBe('iOS 17.5');
    // Let the effect settle: nothing is sent.
    await waitFor(() => expect(result.current.mapSupported).toBe(true));
    expect(AnalyticsService.trackEvent).not.toHaveBeenCalled();
  });

  it('fires one measurement per page session, not one per mount', async () => {
    setAgent(IOS_15_SAFARI_15);

    const first = await renderHook(() => useMapCapability());
    await waitFor(() => expect(AnalyticsService.trackEvent).toHaveBeenCalledTimes(1));

    // A remount is still the same page session: the verdict belongs to the browser,
    // and the count the dashboard reads has to be of devices, not of renders.
    await first.unmount();
    const second = await renderHook(() => useMapCapability());
    expect(AnalyticsService.trackEvent).toHaveBeenCalledTimes(1);
    await second.unmount();
  });

  it('reports an unknown OS as unknown, without measuring a supported browser', async () => {
    setAgent('some unrecognized agent');

    const { result } = await renderHook(() => useMapCapability());

    expect(result.current.mapSupported).toBe(true);
    expect(result.current.osVersion).toBeNull();
    await waitFor(() => expect(result.current.mapSupported).toBe(true));
    expect(AnalyticsService.trackEvent).not.toHaveBeenCalled();
  });
});
