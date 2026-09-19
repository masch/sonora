import { renderHook, act } from '@testing-library/react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { useBackgroundSync, BACKGROUND_SYNC_TASK } from '../use-background-sync';
import { useRemoteConfigStore } from '@/store/remote-config-store';

// Mock expo-background-fetch
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
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
      await renderHook(() => useBackgroundSync());
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK, {
      minimumInterval: useRemoteConfigStore.getState().config.feedback.syncIntervalSec,
      stopOnTerminate: true,
      startOnBoot: false,
    });
  });

  it('unregisters legacy task before re-registering with safe options if already registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(true);
    (BackgroundFetch.unregisterTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);
    (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await act(async () => {
      await renderHook(() => useBackgroundSync());
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK, {
      minimumInterval: useRemoteConfigStore.getState().config.feedback.syncIntervalSec,
      stopOnTerminate: true,
      startOnBoot: false,
    });
  });
});
