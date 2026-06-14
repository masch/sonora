import { renderHook, act } from '@testing-library/react-hooks';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { useRegisterBackgroundTask } from '../use-register-background-task';

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

describe('useRegisterBackgroundTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a task with options if not registered', async () => {
    const taskName = 'test-task';
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(false);
    (BackgroundFetch.registerTaskAsync as jest.Mock).mockResolvedValueOnce(undefined);

    await act(async () => {
      renderHook(() => useRegisterBackgroundTask(taskName, { minimumInterval: 300 }));
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(taskName);
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(taskName, {
      minimumInterval: 300,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  });

  it('does not register a task if already registered', async () => {
    const taskName = 'test-task';
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValueOnce(true);

    await act(async () => {
      renderHook(() => useRegisterBackgroundTask(taskName));
    });

    expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(taskName);
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });
});
