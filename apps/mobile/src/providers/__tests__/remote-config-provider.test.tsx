import React from 'react';
import { render, waitFor, screen, fireEvent, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { RemoteConfigPayload } from '@sonora/shared';
import { ApiClient } from '../../services/api-client';
import { getCachedConfig, setCachedConfig } from '../../storage/config-cache';
import { ConfigProvider, useRemoteConfig } from '../remote-config-provider';

// ── Mocks ──────────────────────────────────────────────────────────

jest.mock('../../storage/config-cache', () => ({
  getCachedConfig: jest.fn(),
  setCachedConfig: jest.fn().mockResolvedValue(undefined),
  clearCachedConfig: jest.fn(),
}));

jest.mock('../../services/api-client', () => ({
  ApiClient: {
    get: jest.fn(),
  },
}));

const mockApiGet = ApiClient.get as jest.Mock;
const mockGetCachedConfig = getCachedConfig as jest.Mock;
const mockSetCachedConfig = setCachedConfig as jest.Mock;

// ── Test consumer component ────────────────────────────────────────

function TestConsumer() {
  const { config, isLoading, error, refetch } = useRemoteConfig();

  if (isLoading) return <Text testID="loading">Loading…</Text>;

  return (
    <>
      {error ? <Text testID="error">{error.message}</Text> : null}
      <Text testID="config">{JSON.stringify(config)}</Text>
      <Text testID="refetch-trigger" onPress={refetch}>
        {''}
      </Text>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  geofence: { radiusMeters: 50 },
  bypassGeofence: false,
  audio: { rewindOffsetMs: 10000 },
  feedback: { syncIntervalSec: 30 },
};

function renderProvider() {
  return render(
    <ConfigProvider>
      <TestConsumer />
    </ConfigProvider>,
  );
}

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  // Default: no cache, API succeeds with empty override
  mockGetCachedConfig.mockResolvedValue(null);
  mockApiGet.mockResolvedValue({});
});

// ── Tests ──────────────────────────────────────────────────────────

describe('ConfigProvider', () => {
  it('renders children and shows loading state initially', () => {
    // Don't resolve the API call — keep loading
    mockApiGet.mockImplementation(() => new Promise(() => {}));

    renderProvider();

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('fetch API and merge remote config on success', async () => {
    mockApiGet.mockResolvedValue({
      geofence: { radiusMeters: 200 },
      bypassGeofence: true,
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    // Remote values override defaults
    expect(config.geofence.radiusMeters).toBe(200);
    expect(config.bypassGeofence).toBe(true);
    // Missing fields keep defaults
    expect(config.audio.rewindOffsetMs).toBe(10000);
    expect(config.feedback.syncIntervalSec).toBe(30);
    // Cache was written
    expect(mockSetCachedConfig).toHaveBeenCalledWith(
      expect.objectContaining({ geofence: { radiusMeters: 200 } }),
    );
  });

  it('uses defaults when API fetch fails and no cache exists', async () => {
    mockApiGet.mockRejectedValue(new Error('Network Error'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('uses cached config when API fails and cache exists', async () => {
    const cachedConfig = {
      geofence: { radiusMeters: 300 },
      bypassGeofence: true,
      audio: { rewindOffsetMs: 20000 },
      feedback: { syncIntervalSec: 300 },
    };
    mockGetCachedConfig.mockResolvedValue(cachedConfig);
    mockApiGet.mockRejectedValue(new Error('Offline'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    expect(config).toEqual(cachedConfig);
  });

  it('shows error state when API fails and no cache and no defaults available', async () => {
    mockGetCachedConfig.mockResolvedValue(null);
    mockApiGet.mockRejectedValue(new Error('Server Error'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeTruthy();
    });

    expect(screen.getByTestId('error').props.children).toBe('Server Error');
  });

  it('handles partial response — received fields override, missing keep defaults', async () => {
    mockApiGet.mockResolvedValue({ bypassGeofence: true });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    expect(config.bypassGeofence).toBe(true);
    expect(config.geofence.radiusMeters).toBe(50);
    expect(config.audio.rewindOffsetMs).toBe(10000);
  });

  it('handles type mismatch — discards invalid field, keeps default', async () => {
    mockApiGet.mockResolvedValue({
      geofence: { radiusMeters: 'not-a-number' },
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    // Invalid field fell back to default
    expect(config.geofence.radiusMeters).toBe(50);
  });

  it('silently falls back to defaults when API request is aborted (timeout)', async () => {
    // Simulate the AbortError that the timeout controller produces
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockApiGet.mockRejectedValue(abortError);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    // Should silently fall back to defaults without error
    expect(config).toEqual(DEFAULT_CONFIG);
    // No error element should be present
    expect(screen.queryByTestId('error')).toBeNull();
  });

  it('fills missing cache fields with defaults', async () => {
    // Cache only has geofence
    const partialCache = {
      geofence: { radiusMeters: 999 },
    } as RemoteConfigPayload;
    mockGetCachedConfig.mockResolvedValue(partialCache);
    // API fails — forces cache-only fallback
    mockApiGet.mockRejectedValue(new Error('Offline'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    // Cache fields preserved
    expect(config.geofence.radiusMeters).toBe(999);
    // Missing cache fields filled from defaults
    expect(config.bypassGeofence).toBe(false);
    expect(config.audio.rewindOffsetMs).toBe(10000);
    expect(config.feedback.syncIntervalSec).toBe(30);
  });

  it('passes an AbortSignal to ApiClient.get for timeout control', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockApiGet.mockImplementation((_path: string, options?: { signal?: AbortSignal }) => {
      capturedSignal = options?.signal;
      return Promise.reject(new Error('ignore'));
    });

    renderProvider();

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });

    expect(capturedSignal!.aborted).toBe(false);
    // Signal should be an instance of AbortSignal
    expect(capturedSignal!.constructor.name).toBe('AbortSignal');
  });

  it('refetch triggers a new API call and updates config', async () => {
    // First call returns config A
    mockApiGet.mockResolvedValueOnce({ geofence: { radiusMeters: 100 } });

    renderProvider();

    // Wait for initial config
    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    let config = JSON.parse(screen.getByTestId('config').props.children);
    expect(config.geofence.radiusMeters).toBe(100);

    // Second API call returns config B
    mockApiGet.mockResolvedValueOnce({ geofence: { radiusMeters: 500 } });

    // Trigger refetch — should transiently show loading then settle with new config
    await act(async () => {
      fireEvent.press(screen.getByTestId('refetch-trigger'));
    });

    // Wait for new config (refetch triggers async loadConfig which auto-resolves)
    await waitFor(() => {
      expect(screen.getByTestId('config')).toBeTruthy();
    });

    config = JSON.parse(screen.getByTestId('config').props.children);
    expect(config.geofence.radiusMeters).toBe(500);
    // Unchanged fields still have defaults
    expect(config.bypassGeofence).toBe(false);
  });
});
