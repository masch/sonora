import { renderHook, act } from '@testing-library/react-native';
import Storage from 'expo-sqlite/kv-store';
import NetInfo from '@react-native-community/netinfo';
import { useFeedbackSync } from '../use-feedback-sync';

// In-memory store for the kv-store mock
const memoryStore: Record<string, string> = {};
const mockStorage = Storage as jest.Mocked<typeof Storage>;

// Track registered NetInfo handlers
let netInfoHandler: ((state: { isConnected: boolean }) => void) | null = null;

beforeAll(() => {
  mockStorage.getItem.mockImplementation((key: string) =>
    Promise.resolve(memoryStore[key] ?? null),
  );
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
  netInfoHandler = null;

  // Re-apply NetInfo mock implementation
  (NetInfo.addEventListener as jest.Mock).mockImplementation(
    (handler: (state: { isConnected: boolean }) => void) => {
      netInfoHandler = handler;
      return () => {
        netInfoHandler = null;
      };
    },
  );
});

function seedQueue(entries: { id: string; experienceId: string; message: string }[]): void {
  const data = entries.map((e) => ({
    id: e.id,
    experienceId: e.experienceId,
    message: e.message,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  }));
  memoryStore['feedback_queue'] = JSON.stringify(data);
}

async function tick(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

describe('useFeedbackSync', () => {
  it('should flush all pending entries on online transition', async () => {
    seedQueue([
      { id: 'key-1', experienceId: 'track-1', message: 'First' },
      { id: 'key-2', experienceId: 'track-1', message: 'Second' },
    ]);

    // Mock fetch to succeed on all POSTs
    const mockFetch = jest.fn().mockResolvedValue({ status: 201, json: () => ({ status: 'ok' }) });
    globalThis.fetch = mockFetch;

    await renderHook(() => useFeedbackSync());

    // Trigger online transition
    await tick();
    if (netInfoHandler) {
      await act(() => {
        netInfoHandler!({ isConnected: true });
      });
    }

    // Wait for async flush to complete
    await tick();
    await tick();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].body).toContain('First');
    expect(mockFetch.mock.calls[1][1].body).toContain('Second');
  });

  it('should handle partial failure — remove succeeded, keep failed', async () => {
    seedQueue([
      { id: 'key-1', experienceId: 'track-1', message: 'First' },
      { id: 'key-2', experienceId: 'track-1', message: 'Second' },
      { id: 'key-3', experienceId: 'track-1', message: 'Third' },
    ]);

    let callCount = 0;
    const mockFetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve({
          status: 500,
          json: () => ({ status: 'error', errors: ['Server error'] }),
        });
      }
      return Promise.resolve({ status: 201, json: () => ({ status: 'ok' }) });
    });
    globalThis.fetch = mockFetch;

    await renderHook(() => useFeedbackSync());

    await tick();
    if (netInfoHandler) {
      await act(() => {
        netInfoHandler!({ isConnected: true });
      });
    }

    // Wait for flush to complete
    await tick();
    await tick();
    await tick();

    // Check remaining queue — only key-2 should remain
    const remainingRaw = await Storage.getItem('feedback_queue');
    const remaining = remainingRaw ? JSON.parse(remainingRaw) : [];
    const remainingIds = remaining.map((e: { id: string }) => e.id);

    expect(remainingIds).toHaveLength(1);
    expect(remainingIds).toContain('key-2');
  });

  it('should not flush when queue is empty', async () => {
    const mockFetch = jest.fn();
    globalThis.fetch = mockFetch;

    await renderHook(() => useFeedbackSync());

    await tick();
    if (netInfoHandler) {
      await act(() => {
        netInfoHandler!({ isConnected: true });
      });
    }

    await tick();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not double-flush on rapid online/offline toggle', async () => {
    seedQueue([{ id: 'key-1', experienceId: 'track-1', message: 'Only one' }]);

    const mockFetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          // Delay so the second online event arrives before flush completes
          setTimeout(() => resolve({ status: 201, json: () => ({ status: 'ok' }) }), 100);
        }),
    );
    globalThis.fetch = mockFetch;

    await renderHook(() => useFeedbackSync());

    await tick();

    // Rapid toggle: online → offline → online before first flush completes
    if (netInfoHandler) {
      await act(() => {
        netInfoHandler!({ isConnected: true });
      });
      await act(() => {
        netInfoHandler!({ isConnected: false });
      });
      await act(() => {
        netInfoHandler!({ isConnected: true });
      });
    }

    // Wait for all flushes to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    // Should only have flushed ONCE (flushingRef prevented concurrent)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should start a periodic interval on all platforms', async () => {
    jest.useFakeTimers();

    seedQueue([{ id: 'key-1', experienceId: 'track-1', message: 'Periodic test' }]);
    const mockFetch = jest.fn().mockResolvedValue({ status: 201, json: () => ({ status: 'ok' }) });
    globalThis.fetch = mockFetch;

    await renderHook(() => useFeedbackSync());

    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
