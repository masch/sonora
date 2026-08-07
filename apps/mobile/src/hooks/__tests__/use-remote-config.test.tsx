import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useRemoteConfig } from '../use-remote-config';
import { useRemoteConfigStore } from '../../store/remote-config-store';
import { ApiClient } from '../../services/api-client';
import { getCachedConfig } from '../../storage/config-cache';
import { DEFAULT_REMOTE_CONFIG } from '@sonora/shared';

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
  // Reset store to initial state
  useRemoteConfigStore.setState({
    config: DEFAULT_REMOTE_CONFIG,
    isLoading: true,
    error: null,
    versionStatus: 'ok',
  });
  mockGetCachedConfig.mockResolvedValue(null);
  mockApiGet.mockResolvedValue({});
});

// ── Tests ──────────────────────────────────────────────────────────

describe('useRemoteConfig', () => {
  it('returns merged config after init resolves', async () => {
    mockApiGet.mockResolvedValue({
      geofence: {
        trip: { radiusMeters: 200, defaultMode: 'formatDefaultRadius' },
        track: { radiusMeters: 50, defaultMode: 'entityRadius' },
        bypassGeofence: true,
      },
    });

    // Init the store before the component renders
    await useRemoteConfigStore.getState().init();

    function Consumer() {
      const { config } = useRemoteConfig();
      return <Text testID="config">{JSON.stringify(config)}</Text>;
    }

    await render(<Consumer />);

    const configText = screen.getByTestId('config').props.children;
    const config = JSON.parse(configText);

    expect(config.geofence.trip.radiusMeters).toBe(200);
    expect(config.geofence.bypassGeofence).toBe(true);
  });

  it('returns loading state initially before init', async () => {
    function Consumer() {
      const { isLoading } = useRemoteConfig();
      return <Text testID="loading-state">{isLoading ? 'Loading' : 'Done'}</Text>;
    }

    await render(<Consumer />);

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading');
  });

  it('returns default config when no API overrides', async () => {
    // Init with empty API response
    await useRemoteConfigStore.getState().init();

    function Consumer() {
      const { config } = useRemoteConfig();
      return (
        <Text testID="vals">
          {`${config.geofence.trip.radiusMeters}|${config.geofence.bypassGeofence}|${config.audio.rewindOffsetMs}|${config.feedback.syncIntervalSec}`}
        </Text>
      );
    }

    await render(<Consumer />);

    expect(screen.getByTestId('vals')).toHaveTextContent('50|false|10000|30');
  });
});
