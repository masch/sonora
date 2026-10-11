import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useLeadCapture } from '@/hooks/use-lead-capture';
import { LeadClient } from '@/services/lead-client';

const mockMap: Record<string, string> = {
  'leadCapture.validation.empty': 'Email cannot be empty',
  'leadCapture.validation.invalid': 'Please enter a valid email address',
  'leadCapture.error': 'Something went wrong. Please try again.',
};

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (k: string) => mockMap[k] ?? k,
  }),
}));

jest.mock('@/services/lead-client', () => ({
  LeadClient: {
    submitLead: jest.fn(),
  },
}));

describe('useLeadCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with initial idle state', async () => {
    const { result } = await renderHook(() => useLeadCapture({ source: 'track_detail' }));

    expect(result.current.email).toBe('');
    expect(result.current.status).toBe('idle');
    expect(result.current.validationError).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('updates email and clears validation errors on setEmail', async () => {
    const { result } = await renderHook(() => useLeadCapture({ source: 'track_detail' }));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.validationError).toBe('Email cannot be empty');

    await act(async () => {
      result.current.setEmail('user@');
    });

    expect(result.current.email).toBe('user@');
    expect(result.current.validationError).toBeNull();
  });

  it('validates empty email without submitting', async () => {
    const { result } = await renderHook(() => useLeadCapture({ source: 'track_detail' }));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.validationError).toBe('Email cannot be empty');
    expect(LeadClient.submitLead).not.toHaveBeenCalled();
  });

  it('validates invalid email format without submitting', async () => {
    const { result } = await renderHook(() => useLeadCapture({ source: 'track_detail' }));

    await act(async () => {
      result.current.setEmail('invalid-email');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.validationError).toBe('Please enter a valid email address');
    expect(LeadClient.submitLead).not.toHaveBeenCalled();
  });

  it('submits valid email and transitions to success', async () => {
    (LeadClient.submitLead as jest.Mock).mockResolvedValueOnce({ status: 'ok' });
    const onSubmitSuccess = jest.fn();

    const { result } = await renderHook(() =>
      useLeadCapture({
        source: 'track_detail',
        experienceId: '123e4567-e89b-12d3-a456-426614174000',
        onSubmitSuccess,
      }),
    );

    await act(async () => {
      result.current.setEmail('test@example.com');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(LeadClient.submitLead).toHaveBeenCalledWith({
        email: 'test@example.com',
        source: 'track_detail',
        experienceId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.current.status).toBe('success');
      expect(result.current.isSuccess).toBe(true);
      expect(onSubmitSuccess).toHaveBeenCalled();
    });
  });

  it('handles submission error and sets errorMessage', async () => {
    (LeadClient.submitLead as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = await renderHook(() => useLeadCapture({ source: 'trip_detail' }));

    await act(async () => {
      result.current.setEmail('test@example.com');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.isError).toBe(true);
      expect(result.current.errorMessage).toBe('Something went wrong. Please try again.');
    });
  });

  it('resets state on handleDismiss', async () => {
    const { result } = await renderHook(() => useLeadCapture({ source: 'track_detail' }));

    await act(async () => {
      result.current.setEmail('test@example.com');
    });

    expect(result.current.email).toBe('test@example.com');

    await act(async () => {
      result.current.handleDismiss();
    });

    expect(result.current.email).toBe('');
    expect(result.current.status).toBe('idle');
  });
});
