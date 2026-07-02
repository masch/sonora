import { renderHook, act } from '@testing-library/react-hooks';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { useBackgroundSync, BACKGROUND_SYNC_TASK } from '../use-background-sync';
import { useRemoteConfigStore } from '@/store/remote-config-store';

// Mock expo-background-fetch
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  BackgroundFetchResult: {
    NewData: 'NewData',
    Failed: 'Failed',
    NoData: 'NoData',
  },
}));

// Mock expo-task-manager
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
}));

// Mock flushQueue
jest.mock('../use-feedback-sync', () => ({
  flushQueue: jest.fn(() => Promise.resolve()),
}));

describe('useBackgroundSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers background fetch task if not already registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(false);
    (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await act(async () => {
      renderHook(() => useBackgroundSync());
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK, {
      minimumInterval: useRemoteConfigStore.getState().config.feedback.syncIntervalSec,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  });

  it('does not register background fetch task again if already registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(true);

    await act(async () => {
      renderHook(() => useBackgroundSync());
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });
});
