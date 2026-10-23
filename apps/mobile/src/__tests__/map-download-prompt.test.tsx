import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  DEFAULT_REMOTE_CONFIG,
  type MapCellularPolicy,
  type RemoteConfigPayload,
} from '@sonora/shared';

import { MapDownloadPrompt } from '@/components/map/map-download-prompt';
import { formatBytes } from '@/utils/format-bytes';
import { archiveFileName, archiveIdentity } from '@/services/map-archives';
import { ensureArchiveOnDisk, listDownloadedArchives } from '@/services/map-archive-download';
import { useRemoteConfigStore } from '@/store/remote-config-store';
import { TwView } from '@/tw';

// The connection decides whether the set is downloaded silently or asked about, so
// each case says exactly what the platform reports.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

// The transfer is not what this suite is about: it records which archives were asked
// for, and `listDownloadedArchives` says what the device already holds.
jest.mock('@/services/map-archive-download', () => ({
  ensureArchiveOnDisk: jest.fn(),
  listDownloadedArchives: jest.fn(),
}));

// The real `t` would hand the component the key itself and no interpolation, so the
// copy this suite reads would be the thing it is trying to prove. Resolving the real
// `en` strings, with the same `{{…}}` interpolation, is what lets a test assert the
// total and the region count on screen.
jest.mock('@/hooks/use-translation', () => {
  const { en } = jest.requireActual('@sonora/shared') as typeof import('@sonora/shared');

  const lookup = (key: string): string => {
    const found = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        en as unknown,
      );
    return typeof found === 'string' ? found : key;
  };

  const translate = (key: string, options?: Record<string, unknown>): string =>
    lookup(key).replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) =>
      String(options?.[name] ?? ''),
    );

  return {
    useAppTranslation: () => ({
      t: translate,
      i18n: { language: 'en' },
      language: 'en' as const,
    }),
  };
});

const mockedFetch = jest.mocked(NetInfo.fetch);
const mockedEnsureOnDisk = jest.mocked(ensureArchiveOnDisk);
const mockedListDownloaded = jest.mocked(listDownloadedArchives);

const ARCHIVE_ORIGIN = 'https://media.sonora.test';

/** The url the server derives for one region, over the shared generator's path. */
const archiveUrl = (region: string): string =>
  `${ARCHIVE_ORIGIN}/media/public/tiles/${region}/v1.pmtiles`;

const CALAMUCHITA_BYTES = 826_000;
const VALLE_AZUL_BYTES = 1_600_000;

const REGIONS = {
  calamuchita: {
    bbox: [-64.83, -32.28, -64.66, -32.12] as [number, number, number, number],
    label: 'Valle de Calamuchita',
    archiveUrl: archiveUrl('calamuchita'),
    archiveBytes: CALAMUCHITA_BYTES,
  },
  'valle-azul': {
    bbox: [-64.6, -31.9, -64.3, -31.7] as [number, number, number, number],
    label: 'Valle Azul',
    archiveUrl: archiveUrl('valle-azul'),
    archiveBytes: VALLE_AZUL_BYTES,
  },
};

interface NetworkState {
  type: string;
  isConnected: boolean;
  isInternetReachable: boolean;
}

const WIFI: NetworkState = { type: 'wifi', isConnected: true, isInternetReachable: true };
const CELLULAR: NetworkState = { type: 'cellular', isConnected: true, isInternetReachable: true };
const OFFLINE: NetworkState = { type: 'none', isConnected: false, isInternetReachable: false };

function setNetwork(state: NetworkState): void {
  mockedFetch.mockResolvedValue(state as unknown as Awaited<ReturnType<typeof NetInfo.fetch>>);
}

interface MapConfigOverrides {
  renderer?: 'leaflet' | 'maplibre';
  preload?: string[];
  cellular?: MapCellularPolicy;
  autoMaxBytes?: number;
}

/** The payload `/config` would have handed the app. */
function setMapConfig({
  renderer = 'maplibre',
  preload = ['calamuchita', 'valle-azul'],
  cellular = 'ask',
  autoMaxBytes = 8_000_000,
}: MapConfigOverrides = {}): void {
  const config: RemoteConfigPayload = {
    ...DEFAULT_REMOTE_CONFIG,
    map: {
      renderer,
      styleUrl: `${ARCHIVE_ORIGIN}/media/public/styles/v1.json`,
      regions: REGIONS,
      download: { preload, autoMaxBytes, cacheMaxBytes: 100_000_000, cellular },
    },
  };
  useRemoteConfigStore.setState({ config });
}

/** The prompt as the root layout mounts it, next to whatever else the app draws. */
async function renderApp(): Promise<void> {
  await render(
    <TwView testID="app-content">
      <MapDownloadPrompt />
    </TwView>,
  );
}

/**
 * Lets the startup lifecycle reach its conclusion: the network is read after the
 * payload, and nothing is asserted until that turn has been taken.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** The urls this run asked the transfer layer for, in order. */
function downloadedUrls(): string[] {
  return mockedEnsureOnDisk.mock.calls.map((call) => call[0].archiveUrl);
}

describe('MapDownloadPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEnsureOnDisk.mockResolvedValue('pmtiles:///documents/map-archives/archive.pmtiles');
    mockedListDownloaded.mockReturnValue([]);
    setNetwork(WIFI);
    setMapConfig();
  });

  it('downloads nothing and asks nothing when the device resolves to leaflet', async () => {
    setMapConfig({ renderer: 'leaflet' });

    await renderApp();
    await settle();

    // The Leaflet path never even prices the set, so it reads no network at all.
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
    expect(screen.queryByTestId('map-download-prompt')).toBeNull();
  });

  it('downloads the whole preload set silently on WiFi under the ceiling', async () => {
    setMapConfig({ autoMaxBytes: 8_000_000 });

    await renderApp();
    await settle();

    await waitFor(() => expect(mockedEnsureOnDisk).toHaveBeenCalledTimes(2));
    expect(downloadedUrls()).toEqual([
      REGIONS.calamuchita.archiveUrl,
      REGIONS['valle-azul'].archiveUrl,
    ]);
    expect(screen.queryByTestId('map-download-prompt')).toBeNull();
  });

  it('asks one question for the whole set on cellular, showing the total', async () => {
    setNetwork(CELLULAR);

    await renderApp();
    await settle();

    await waitFor(() => expect(screen.getByTestId('map-download-prompt')).toBeTruthy());
    // One prompt for the set, never one per region.
    expect(screen.getAllByTestId('map-download-prompt-accept')).toHaveLength(1);
    // The total is what the walker approves: 826 KB + 1,6 MB.
    expect(screen.getByText(/2\.4 MB in total/)).toBeTruthy();
    expect(screen.getByText('Valle de Calamuchita')).toBeTruthy();
    expect(screen.getByText('Valle Azul')).toBeTruthy();
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
  });

  it('downloads nothing when the prompt is dismissed', async () => {
    setNetwork(CELLULAR);

    await renderApp();
    await waitFor(() => expect(screen.getByTestId('map-download-prompt-dismiss')).toBeTruthy());

    fireEvent.press(screen.getByTestId('map-download-prompt-dismiss'));
    await settle();

    expect(screen.queryByTestId('map-download-prompt')).toBeNull();
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
  });

  it('downloads each missing region once when the prompt is accepted', async () => {
    setNetwork(CELLULAR);

    await renderApp();
    await waitFor(() => expect(screen.getByTestId('map-download-prompt-accept')).toBeTruthy());

    fireEvent.press(screen.getByTestId('map-download-prompt-accept'));
    await waitFor(() => expect(mockedEnsureOnDisk).toHaveBeenCalledTimes(2));

    expect(downloadedUrls()).toEqual([
      REGIONS.calamuchita.archiveUrl,
      REGIONS['valle-azul'].archiveUrl,
    ]);
    expect(screen.queryByTestId('map-download-prompt')).toBeNull();
  });

  it('downloads nothing and asks nothing offline, and the app still renders', async () => {
    setNetwork(OFFLINE);

    await renderApp();
    await settle();

    // The prefetch did run and decided to spend nothing.
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
    expect(screen.queryByTestId('map-download-prompt')).toBeNull();
    expect(screen.getByTestId('app-content')).toBeTruthy();
  });

  it('neither prices nor re-downloads a region that is already on the device', async () => {
    setNetwork(CELLULAR);
    const onDevice = archiveIdentity(REGIONS.calamuchita.archiveUrl, 'calamuchita');
    if (!onDevice) throw new Error('the fixture url must name a version');
    mockedListDownloaded.mockReturnValue([
      { ...onDevice, name: archiveFileName(onDevice), bytes: CALAMUCHITA_BYTES },
    ]);

    await renderApp();
    await waitFor(() => expect(screen.getByTestId('map-download-prompt-accept')).toBeTruthy());

    // The downloaded region is not part of the price, so the total is the other one,
    // and the copy speaks of a single region.
    expect(screen.queryByText(/2\.4 MB/)).toBeNull();
    expect(screen.getByText(/1 map region, 1\.6 MB in total/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-download-prompt-accept'));
    await waitFor(() => expect(mockedEnsureOnDisk).toHaveBeenCalledTimes(1));

    expect(downloadedUrls()).toEqual([REGIONS['valle-azul'].archiveUrl]);
  });
});

describe('formatBytes', () => {
  it('drops the decimal when the size is a whole number of units', () => {
    expect(formatBytes(826_000, 'en')).toBe('826 KB');
    expect(formatBytes(8_000_000, 'en')).toBe('8 MB');
  });

  it('keeps one decimal when it matters, in the language of the reader', () => {
    expect(formatBytes(1_600_000, 'en')).toBe('1.6 MB');
    expect(formatBytes(1_600_000, 'es')).toBe('1,6 MB');
    expect(formatBytes(2_426_000, 'en')).toBe('2.4 MB');
    expect(formatBytes(2_426_000, 'es')).toBe('2,4 MB');
  });

  it('falls back to bytes below one kilobyte', () => {
    expect(formatBytes(0, 'en')).toBe('0 B');
    expect(formatBytes(999, 'en')).toBe('999 B');
  });
});
