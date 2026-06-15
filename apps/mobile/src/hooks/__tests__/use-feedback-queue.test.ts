import { renderHook, act } from '@testing-library/react-hooks';
import Storage from 'expo-sqlite/kv-store';
import { useFeedbackQueue } from '../use-feedback-queue';

// Create a simple in-memory store for the mock
const memoryStore: Record<string, string> = {};

const mockStorage = Storage as jest.Mocked<typeof Storage>;

beforeAll(() => {
  mockStorage.getItem.mockImplementation((key: string) => {
    return Promise.resolve(memoryStore[key] ?? null);
  });
  mockStorage.setItem.mockImplementation((key: string, value: string | unknown) => {
    memoryStore[key] = String(value);
    return Promise.resolve();
  });
  mockStorage.removeItem.mockImplementation((key: string) => {
    delete memoryStore[key];
    return Promise.resolve();
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
});

async function waitForQueueLoaded(
  result: { current: ReturnType<typeof useFeedbackQueue> },
  maxWaitMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (!result.current.loaded && Date.now() - start < maxWaitMs) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  }
}

describe('useFeedbackQueue', () => {
  it('should enqueue a feedback entry with a generated id', async () => {
    const { result } = renderHook(() => useFeedbackQueue());

    await waitForQueueLoaded(result);

    let entryId: string | undefined;
    await act(async () => {
      entryId = await result.current.enqueue({
        tripId: 'trip-1',
        message: 'Great trail!',
      });
    });

    expect(entryId).toBeDefined();
    expect(typeof entryId).toBe('string');
    expect(Storage.setItem).toHaveBeenCalled();
  });

  it('should peek all queued entries', async () => {
    const { result } = renderHook(() => useFeedbackQueue());

    await waitForQueueLoaded(result);

    await act(async () => {
      await result.current.enqueue({ tripId: 'trip-1', message: 'First' });
    });

    await act(async () => {
      await result.current.enqueue({ tripId: 'trip-2', message: 'Second' });
    });

    const allEntries = result.current.getAll();
    expect(allEntries).toHaveLength(2);
    expect(allEntries[0].message).toBe('First');
    expect(allEntries[1].message).toBe('Second');
  });

  it('should remove a specific entry by id', async () => {
    const { result } = renderHook(() => useFeedbackQueue());

    await waitForQueueLoaded(result);

    let entryId: string | undefined;
    await act(async () => {
      entryId = await result.current.enqueue({ tripId: 'trip-1', message: 'To remove' });
    });

    await act(async () => {
      // Wait for state to settle after enqueue
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.getAll()).toHaveLength(1);

    await act(async () => {
      await result.current.remove(entryId!);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.getAll()).toHaveLength(0);
  });

  it('should clear the entire queue', async () => {
    const { result } = renderHook(() => useFeedbackQueue());

    await waitForQueueLoaded(result);

    await act(async () => {
      await result.current.enqueue({ tripId: 'trip-1', message: 'A' });
    });
    await act(async () => {
      await result.current.enqueue({ tripId: 'trip-2', message: 'B' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.getAll()).toHaveLength(2);

    await act(async () => {
      await result.current.clear();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.getAll()).toHaveLength(0);
  });

  it('should not create duplicate entries with the same idempotency key', async () => {
    const { result } = renderHook(() => useFeedbackQueue());

    await waitForQueueLoaded(result);

    let firstId: string | undefined;
    let secondId: string | undefined;
    await act(async () => {
      firstId = await result.current.enqueue({ tripId: 'trip-1', message: 'Same key' });
      secondId = await result.current.enqueue({ tripId: 'trip-1', message: 'Same key' }, firstId);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Second enqueue with same key should not add a new entry
    expect(result.current.getAll()).toHaveLength(1);
    expect(secondId).toBe(firstId);
  });
});
