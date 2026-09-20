import { renderHook, act } from '@testing-library/react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { useRegisterBackgroundTask } from '../use-register-background-task';

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

describe('useRegisterBackgroundTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a task with safe options (stopOnTerminate: true, startOnBoot: false) if not registered', async () => {
    const taskName = 'test-task';
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(false);
    (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await act(async () => {
      await renderHook(() => useRegisterBackgroundTask(taskName, { minimumInterval: 300 }));
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(taskName);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(taskName, {
      minimumInterval: 300,
      stopOnTerminate: true,
      startOnBoot: false,
    });
  });

  it('unregisters legacy task before re-registering with safe options if already registered', async () => {
    const taskName = 'test-task';
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(true);
    (BackgroundFetch.unregisterTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);
    (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await act(async () => {
      await renderHook(() => useRegisterBackgroundTask(taskName));
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(taskName);
    expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledWith(taskName);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(taskName, {
      minimumInterval: 15 * 60,
      stopOnTerminate: true,
      startOnBoot: false,
    });
  });

  it('handles rapid rerenders safely by serializing and ignoring stale in-flight calls', async () => {
    const taskName = 'concurrent-task';
    let resolveFirstTaskCheck!: (value: boolean) => void;
    const firstCheckPromise = new Promise<boolean>((resolve) => {
      resolveFirstTaskCheck = resolve;
    });

    (TaskManager.isTaskRegisteredAsync as jest.Mock)
      .mockReturnValueOnce(firstCheckPromise)
      .mockResolvedValueOnce(false);
    (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValue(undefined);

    const { rerender } = await renderHook(
      ({ interval }: { interval: number }) =>
        useRegisterBackgroundTask(taskName, { minimumInterval: interval }),
      { initialProps: { interval: 100 } },
    );

    // Rerender with new interval before the first check resolves
    await act(async () => {
      rerender({ interval: 200 });
    });

    // Now resolve the first check
    await act(async () => {
      resolveFirstTaskCheck(false);
    });

    // The second registration should finish with interval 200, and first stale registration was cancelled
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledTimes(1);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(taskName, {
      minimumInterval: 200,
      stopOnTerminate: true,
      startOnBoot: false,
    });
  });
});
