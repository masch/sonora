import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ConfigProvider } from '../../providers/remote-config-provider';
import { useRemoteConfig } from '../use-remote-config';
import { ApiClient } from '../../services/api-client';
import { getCachedConfig } from '../../storage/config-cache';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedConfig.mockResolvedValue(null);
  mockApiGet.mockResolvedValue({});
});

// ── Tests ──────────────────────────────────────────────────────────

describe('useRemoteConfig', () => {
  it('returns merged config when used inside ConfigProvider', async () => {
    mockApiGet.mockResolvedValue({
      geofence: { radiusMeters: 200 },
    });

    let capturedConfig: unknown;
    function Consumer() {
      const { config, isLoading } = useRemoteConfig();
      if (!isLoading) {
        capturedConfig = config;
      }
      return <Text>{isLoading ? 'Loading' : 'Ready'}</Text>;
    }

    render(
      <ConfigProvider>
        <Consumer />
      </ConfigProvider>,
    );

    await screen.findByText('Ready');

    expect(capturedConfig).toBeDefined();
    const config = capturedConfig as Record<string, unknown>;
    expect(config.geofence).toEqual({ radiusMeters: 200 });
    expect(config.bypassGeofence).toBe(false);
  });

  it('returns loading state initially', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}));

    function Consumer() {
      const { isLoading } = useRemoteConfig();
      return <Text testID="loading-state">{isLoading ? 'Loading' : 'Done'}</Text>;
    }

    render(
      <ConfigProvider>
        <Consumer />
      </ConfigProvider>,
    );

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading');
  });

  it('returns default config when no API overrides', async () => {
    mockApiGet.mockResolvedValue({});

    function Consumer() {
      const { config, isLoading } = useRemoteConfig();
      return (
        <Text testID="vals">
          {isLoading
            ? 'Load'
            : `${config.geofence.radiusMeters}|${config.bypassGeofence}|${config.audio.rewindOffsetMs}|${config.feedback.syncIntervalSec}`}
        </Text>
      );
    }

    render(
      <ConfigProvider>
        <Consumer />
      </ConfigProvider>,
    );

    await screen.findByText('50|false|10000|30');
    expect(screen.getByTestId('vals')).toHaveTextContent('50|false|10000|30');
  });
});
