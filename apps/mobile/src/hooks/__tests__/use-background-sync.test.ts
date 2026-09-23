import { renderHook, act } from '@testing-library/react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { useBackgroundSync, BACKGROUND_SYNC_TASK } from '../use-background-sync';

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

describe('useBackgroundSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unregisters legacy background task if currently registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(true);
    (BackgroundFetch.unregisterTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await act(async () => {
      await renderHook(() => useBackgroundSync());
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('does nothing if legacy background task is not registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(false);

    await act(async () => {
      await renderHook(() => useBackgroundSync());
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK);
    expect(BackgroundFetch.unregisterTaskAsync).not.toHaveBeenCalled();
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });
});
