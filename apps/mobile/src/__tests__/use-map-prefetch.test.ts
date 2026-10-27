import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';

import { useMapPrefetch } from '@/hooks/use-map-prefetch';
import { ensureArchiveOnDisk, listDownloadedArchives } from '@/services/map-archive-download';
import { useRemoteConfigStore } from '@/store/remote-config-store';

// The listing is the whole question here: the prefetch asks the device what it already
// holds before it prices anything, and in a browser that call is what used to throw.
jest.mock('@/services/map-archive-download', () => ({
  ...jest.requireActual('@/services/map-archive-download'),
  ensureArchiveOnDisk: jest.fn(),
  listDownloadedArchives: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}));

const mockedListDownloaded = jest.mocked(listDownloadedArchives);
const mockedEnsureOnDisk = jest.mocked(ensureArchiveOnDisk);

const platform = Platform as unknown as { OS: string };
const originalPlatform = platform.OS;

const ARCHIVE_ORIGIN = 'https://media.sonora.test';

/** The payload `/config` would have handed the app: one region, maplibre, preloaded. */
function setMapConfig(): void {
  const config: RemoteConfigPayload = {
    ...DEFAULT_REMOTE_CONFIG,
    map: {
      renderer: 'maplibre',
      styleUrl: `${ARCHIVE_ORIGIN}/media/public/styles/v1.json`,
      regions: {
        calamuchita: {
          bbox: [-64.83, -32.28, -64.66, -32.12],
          label: 'Valle de Calamuchita',
          archiveUrl: `${ARCHIVE_ORIGIN}/media/public/tiles/calamuchita/v1.pmtiles`,
          archiveBytes: 826_000,
        },
      },
      download: {
        preload: ['calamuchita'],
        autoMaxBytes: 8_000_000,
        cacheMaxBytes: 42_000_000,
        cellular: 'ask',
      },
      layers: { showControl: false, groups: [] },
    },
  };
  useRemoteConfigStore.setState({ config });
}

/** Mounts the hook and lets its effect settle. */
async function mountPrefetch(): Promise<void> {
  await renderHook(() => useMapPrefetch());
  await act(async () => {});
}

describe('useMapPrefetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedListDownloaded.mockReturnValue([]);
    mockedEnsureOnDisk.mockResolvedValue(
      'pmtiles://file:///documents/map-archives/archive.pmtiles',
    );
  });

  afterEach(() => {
    platform.OS = originalPlatform;
  });

  it('prices the device archives on a platform that can keep one', async () => {
    platform.OS = 'ios';
    setMapConfig();

    await mountPrefetch();

    // The asymmetric half of this suite: the same payload and the same mount do call
    // the listing when the platform can hold an archive.
    expect(mockedListDownloaded).toHaveBeenCalled();
  });

  it('never touches the device archives in a browser', async () => {
    platform.OS = 'web';
    setMapConfig();

    await mountPrefetch();

    // `expo-file-system` is an unsupported stub in a browser and that listing throws
    // from inside the effect, which is what surfaced as the crash on the error screen.
    expect(mockedListDownloaded).not.toHaveBeenCalled();
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
  });
});
