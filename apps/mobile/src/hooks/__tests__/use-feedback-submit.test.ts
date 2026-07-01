import { renderHook, act } from '@testing-library/react-hooks';

import { ApiClient } from '@/services/api-client';

// ── Mocks ──────────────────────────────────────────────────────────────

const mockEnqueue = jest.fn<Promise<string>, [unknown, string?]>();

jest.mock('@/hooks/use-feedback-queue', () => ({
  useFeedbackQueue: () => ({
    enqueue: mockEnqueue,
    getAll: jest.fn(() => []),
    remove: jest.fn(),
    clear: jest.fn(),
    loaded: true,
    queue: [],
  }),
}));

jest.mock('@/utils/uuid', () => ({
  generateUUID: () => '00000000-0000-0000-0000-000000000000',
}));

const mockLoggerError = jest.fn();
jest.mock('@/utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────

function renderSubmitHook() {
  return renderHook(() => {
    const { useFeedbackSubmit } = jest.requireActual('@/hooks/use-feedback-submit');
    return useFeedbackSubmit();
  });
}

// ── Suite ──────────────────────────────────────────────────────────────

describe('useFeedbackSubmit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start with idle state', () => {
    const { result } = renderSubmitHook();

    expect(result.current.feedbackStatus).toBeUndefined();
    expect(result.current.feedbackError).toBeNull();
  });

  it('should transition through "sending" before reaching final state', async () => {
    // Use a deferred promise to pause mid-flight
    let resolveApi: () => void;
    const apiPromise = new Promise<void>((resolve) => {
      resolveApi = resolve;
    });
    jest.spyOn(ApiClient, 'post').mockReturnValueOnce(apiPromise);

    const { result } = renderSubmitHook();

    // Start submission — will pause at the API call
    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submitFeedback('exp-1', 'Message');
    });

    // Immediately after starting, status should be 'sending'
    expect(result.current.feedbackStatus).toBe('sending');
    expect(result.current.feedbackError).toBeNull();

    // Resolve the API call
    await act(async () => {
      resolveApi!();
      await submitPromise!;
    });

    expect(result.current.feedbackStatus).toBe('sent');
  });

  it('should set status to sent on successful API call', async () => {
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(undefined);
    const { result } = renderSubmitHook();

    await act(async () => {
      await result.current.submitFeedback('exp-1', 'Great track!');
    });

    expect(ApiClient.post).toHaveBeenCalledWith('/feedback', {
      experienceId: 'exp-1',
      message: 'Great track!',
      idempotencyKey: '00000000-0000-0000-0000-000000000000',
      createdAt: expect.any(String),
    });
    expect(result.current.feedbackStatus).toBe('sent');
    expect(result.current.feedbackError).toBeNull();
  });

  it('should queue feedback when API call fails', async () => {
    jest.spyOn(ApiClient, 'post').mockRejectedValueOnce(new Error('Network error'));
    mockEnqueue.mockResolvedValueOnce('00000000-0000-0000-0000-000000000000');
    const { result } = renderSubmitHook();

    await act(async () => {
      await result.current.submitFeedback('exp-1', 'Great track!');
    });

    expect(mockEnqueue).toHaveBeenCalledWith(
      { experienceId: 'exp-1', message: 'Great track!' },
      '00000000-0000-0000-0000-000000000000',
    );
    expect(result.current.feedbackStatus).toBe('queued');
    expect(result.current.feedbackError).toBeNull();
  });

  it('should set error when both API and queue fail', async () => {
    jest.spyOn(ApiClient, 'post').mockRejectedValueOnce(new Error('Network error'));
    mockEnqueue.mockRejectedValueOnce(new Error('SQLite full'));
    const { result } = renderSubmitHook();

    await act(async () => {
      await result.current.submitFeedback('exp-1', 'Great track!');
    });

    expect(result.current.feedbackStatus).toBe('error');
    expect(result.current.feedbackError).toBe('feedback.form.error');
  });

  it('should log both API and enqueue errors', async () => {
    jest.spyOn(ApiClient, 'post').mockRejectedValueOnce(new Error('Network error'));
    mockEnqueue.mockRejectedValueOnce(new Error('SQLite full'));
    const { result } = renderSubmitHook();

    await act(async () => {
      await result.current.submitFeedback('exp-1', 'Message');
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      '[API_ERROR] Fetch failed, queueing feedback:',
      expect.any(Error),
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[ENQUEUE_ERROR] SQLite fallback failed:',
      expect.any(Error),
    );
  });

  it('should reset state on dismiss', () => {
    const { result } = renderSubmitHook();

    act(() => {
      result.current.dismissFeedback();
    });

    expect(result.current.feedbackStatus).toBeUndefined();
    expect(result.current.feedbackError).toBeNull();
  });

  it('should allow submitting again after dismiss', async () => {
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(undefined);
    const { result } = renderSubmitHook();

    // First submit
    await act(async () => {
      await result.current.submitFeedback('exp-1', 'First');
    });
    expect(result.current.feedbackStatus).toBe('sent');

    // Dismiss
    act(() => {
      result.current.dismissFeedback();
    });
    expect(result.current.feedbackStatus).toBeUndefined();

    // Second submit
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.submitFeedback('exp-2', 'Second');
    });
    expect(result.current.feedbackStatus).toBe('sent');
    expect(ApiClient.post).toHaveBeenCalledTimes(2);
  });

  it('should support sequential submissions without dismiss', async () => {
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(undefined);
    const { result } = renderSubmitHook();

    await act(async () => {
      await result.current.submitFeedback('exp-1', 'First');
    });
    expect(result.current.feedbackStatus).toBe('sent');

    // Submit again — no lock
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.submitFeedback('exp-1', 'Second');
    });
    expect(result.current.feedbackStatus).toBe('sent');
    expect(ApiClient.post).toHaveBeenCalledTimes(2);
  });
});
