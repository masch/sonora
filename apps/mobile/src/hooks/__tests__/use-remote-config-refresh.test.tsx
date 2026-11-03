import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { AppStateStatus, NativeEventSubscription } from 'react-native';

import {
  FOREGROUND_REVALIDATE_FLOOR_MS,
  useRemoteConfigRefresh,
} from '../use-remote-config-refresh';
import { useRemoteConfigStore } from '../../store/remote-config-store';

// The hook exists because `/config` was fetched once per JS process: an app that
// survived in the background never ran its startup effect again, so a published
// map version stayed invisible until the app data was cleared. These tests pin
// the subscription that fixes it, and the floor that keeps an app switch from
// turning into an API call every time a walker glances at a notification.

let appStateListener: ((state: AppStateStatus) => void) | null = null;
const removeSubscription = jest.fn();

const store = useRemoteConfigStore.getState();
let refetchSpy: jest.SpyInstance;

/** The root layout's call site, reduced to the hook under test. */
function Probe(): null {
  useRemoteConfigRefresh();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    handler: (state: AppStateStatus) => void,
  ) => {
    appStateListener = handler;
    return { remove: removeSubscription } as unknown as NativeEventSubscription;
  }) as unknown as typeof AppState.addEventListener);
  refetchSpy = jest.spyOn(store, 'refetch').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Mounts the hook and lets its effect subscribe before `AppState` is driven. */
async function mountRefresh(): Promise<ReturnType<typeof render>> {
  const view = await render(<Probe />);
  await act(async () => {});
  return view;
}

async function appStateBecomes(state: AppStateStatus): Promise<void> {
  await act(async () => {
    appStateListener?.(state);
  });
}

describe('useRemoteConfigRefresh', () => {
  it('revalidates the config when the app comes back to the foreground', async () => {
    await mountRefresh();

    await appStateBecomes('active');

    expect(refetchSpy).toHaveBeenCalledTimes(1);
  });

  it('leaves the config alone when the app goes to the background', async () => {
    await mountRefresh();

    await appStateBecomes('background');
    await appStateBecomes('inactive');

    expect(refetchSpy).not.toHaveBeenCalled();
  });

  it('does not ask twice when the app is switched away and back within the floor', async () => {
    await mountRefresh();

    await appStateBecomes('active');
    await appStateBecomes('background');
    await appStateBecomes('active');

    expect(refetchSpy).toHaveBeenCalledTimes(1);
  });

  it('asks again once the floor has passed', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-03-01T10:00:00Z'));
      await mountRefresh();

      await appStateBecomes('active');
      expect(refetchSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(FOREGROUND_REVALIDATE_FLOOR_MS);
      await appStateBecomes('active');

      expect(refetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops listening when the layout goes away', async () => {
    const { unmount } = await mountRefresh();

    await act(async () => {
      unmount();
    });

    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });
});
