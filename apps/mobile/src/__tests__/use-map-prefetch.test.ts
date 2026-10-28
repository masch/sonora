import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';

import { useMapPrefetch } from '@/hooks/use-map-prefetch';
import { archiveFileName, archiveIdentity, type StoredArchive } from '@/services/map-archives';
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

/** The bytes the payload advertises for the one preloaded region. */
const CALAMUCHITA_BYTES = 826_000;

/** The url the server derives for the one preloaded region. */
const CALAMUCHITA_URL = `${ARCHIVE_ORIGIN}/media/public/tiles/calamuchita/v1.pmtiles`;

/** One archive the device already holds, as the listing describes it. */
function storedArchive(bytes: number): StoredArchive {
  const identity = archiveIdentity(CALAMUCHITA_URL, 'calamuchita');
  if (!identity) throw new Error('the fixture url must name a version');
  return { ...identity, name: archiveFileName(identity), bytes };
}

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
          archiveUrl: CALAMUCHITA_URL,
          archiveBytes: CALAMUCHITA_BYTES,
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

  it('prices a region again when the stored archive is not the size the payload advertises', async () => {
    platform.OS = 'ios';
    setMapConfig();
    // The artifact was overwritten in place under the same name, which is exactly what
    // an overwrite leaves behind: the file is there, and it is not the archive the
    // payload advertises.
    mockedListDownloaded.mockReturnValue([storedArchive(CALAMUCHITA_BYTES - 1)]);

    await mountPrefetch();

    expect(mockedEnsureOnDisk).toHaveBeenCalledTimes(1);
    expect(mockedEnsureOnDisk).toHaveBeenCalledWith({
      archiveUrl: CALAMUCHITA_URL,
      identity: archiveIdentity(CALAMUCHITA_URL, 'calamuchita'),
      cacheMaxBytes: 42_000_000,
    });
  });

  it('skips a region whose stored archive still matches the payload size', async () => {
    platform.OS = 'ios';
    setMapConfig();
    mockedListDownloaded.mockReturnValue([storedArchive(CALAMUCHITA_BYTES)]);

    await mountPrefetch();

    // The other half of the rule: an archive of the advertised size is current, so it
    // costs nothing and is never downloaded again.
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
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
