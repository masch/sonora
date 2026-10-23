import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DEFAULT_REMOTE_CONFIG, type RemoteConfigPayload } from '@sonora/shared';

import { MapDownloadButton } from '@/components/map/map-download-button';
import { archiveFileName, archiveIdentity } from '@/services/map-archives';
import { ensureArchiveOnDisk, listDownloadedArchives } from '@/services/map-archive-download';
import { useRemoteConfigStore } from '@/store/remote-config-store';

// The transfer is not what this suite is about: it records which archive the action
// asked for, under which budget, and `listDownloadedArchives` says what the device
// already holds. The rest of the module (the error-code translation) stays real, so
// the failure path is exercised against the vocabulary the service publishes.
jest.mock('@/services/map-archive-download', () => ({
  ...jest.requireActual('@/services/map-archive-download'),
  ensureArchiveOnDisk: jest.fn(),
  listDownloadedArchives: jest.fn(),
}));

// The real `t` would hand the component the key itself, so the copy this suite reads
// would be the thing it is trying to prove. Resolving the real `en` strings lets the
// test assert what a walker actually sees, and proving they are not the keys.
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

  return {
    useAppTranslation: () => ({
      t: lookup,
      i18n: { language: 'en' },
      language: 'en' as const,
    }),
  };
});

const mockedEnsureOnDisk = jest.mocked(ensureArchiveOnDisk);
const mockedListDownloaded = jest.mocked(listDownloadedArchives);

const ARCHIVE_ORIGIN = 'https://media.sonora.test';

/** The url the server derives for one region, over the shared generator's path. */
const archiveUrl = (region: string): string =>
  `${ARCHIVE_ORIGIN}/media/public/tiles/${region}/v1.pmtiles`;

const CALAMUCHITA_BYTES = 826_000;

/** The only budget the action may spend: it comes from the payload, not from code. */
const CACHE_MAX_BYTES = 42_000_000;

const REGIONS = {
  calamuchita: {
    bbox: [-64.83, -32.28, -64.66, -32.12] as [number, number, number, number],
    label: 'Valle de Calamuchita',
    archiveUrl: archiveUrl('calamuchita'),
    archiveBytes: CALAMUCHITA_BYTES,
  },
};

/** A point inside the published box: the trip the walker is about to take. */
const INSIDE_CALAMUCHITA = { latitude: -32.2, longitude: -64.7 };

/** A point outside every published box: a trip we cover no tiles for. */
const OUTSIDE_EVERY_REGION = { latitude: -34.6037, longitude: -58.3816 };

/** The payload `/config` would have handed the app. */
function setMapConfig({ renderer = 'maplibre' }: { renderer?: 'leaflet' | 'maplibre' } = {}): void {
  const config: RemoteConfigPayload = {
    ...DEFAULT_REMOTE_CONFIG,
    map: {
      renderer,
      styleUrl: `${ARCHIVE_ORIGIN}/media/public/styles/v1.json`,
      regions: REGIONS,
      download: {
        preload: ['calamuchita'],
        autoMaxBytes: 8_000_000,
        cacheMaxBytes: CACHE_MAX_BYTES,
        cellular: 'ask',
      },
    },
  };
  useRemoteConfigStore.setState({ config });
}

/** The button as the trip screen mounts it. */
async function renderFor(point: { latitude: number; longitude: number }): Promise<void> {
  await render(<MapDownloadButton point={point} />);
}

/** The action, once the device has been asked what it already holds. */
async function findButton(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId('map-download-button')).toBeTruthy());
}

describe('MapDownloadButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEnsureOnDisk.mockResolvedValue(
      'pmtiles://file:///documents/map-archives/archive.pmtiles',
    );
    mockedListDownloaded.mockReturnValue([]);
    setMapConfig();
  });

  it('renders nothing and downloads nothing when the device resolves to leaflet', async () => {
    setMapConfig({ renderer: 'leaflet' });

    await renderFor(INSIDE_CALAMUCHITA);

    // Leaflet draws raster OSM tiles and never reads an archive, so the action would
    // be a lie: it must not even appear.
    expect(screen.queryByTestId('map-download-button')).toBeNull();
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
  });

  it('renders nothing and downloads nothing for a point outside every published region', async () => {
    await renderFor(OUTSIDE_EVERY_REGION);

    // Nowhere has no archive to prepare, and the map itself already says so.
    expect(screen.queryByTestId('map-download-button')).toBeNull();
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
  });

  it('reports the archive already on the device as available, disabled, and downloads nothing', async () => {
    const onDevice = archiveIdentity(REGIONS.calamuchita.archiveUrl, 'calamuchita');
    if (!onDevice) throw new Error('the fixture url must name a version');
    mockedListDownloaded.mockReturnValue([
      { ...onDevice, name: archiveFileName(onDevice), bytes: CALAMUCHITA_BYTES },
    ]);

    await renderFor(INSIDE_CALAMUCHITA);
    await findButton();

    expect(screen.getByText('Map available offline')).toBeTruthy();
    expect(screen.getByTestId('map-download-button')).toBeDisabled();

    fireEvent.press(screen.getByTestId('map-download-button'));
    expect(mockedEnsureOnDisk).not.toHaveBeenCalled();
  });

  it('downloads the trip region once, with the payload budget, and ends available', async () => {
    let finishDownload!: (uri: string) => void;
    mockedEnsureOnDisk.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finishDownload = resolve;
        }),
    );

    await renderFor(INSIDE_CALAMUCHITA);
    await findButton();

    fireEvent.press(screen.getByTestId('map-download-button'));

    // The wait is visible while it lasts, and the action cannot be started twice.
    await waitFor(() => expect(screen.getByText('Downloading the map…')).toBeTruthy());
    fireEvent.press(screen.getByTestId('map-download-button'));
    expect(mockedEnsureOnDisk).toHaveBeenCalledTimes(1);

    expect(mockedEnsureOnDisk).toHaveBeenCalledWith({
      archiveUrl: REGIONS.calamuchita.archiveUrl,
      identity: archiveIdentity(REGIONS.calamuchita.archiveUrl, 'calamuchita'),
      cacheMaxBytes: CACHE_MAX_BYTES,
    });

    await act(async () => {
      finishDownload('pmtiles://file:///documents/map-archives/archive.pmtiles');
    });

    await waitFor(() => expect(screen.getByText('Map available offline')).toBeTruthy());
    expect(screen.queryByText('Downloading the map…')).toBeNull();
    expect(screen.getByTestId('map-download-button')).toBeDisabled();
  });

  it('shows one failure line and lets the walker tap again', async () => {
    mockedEnsureOnDisk.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

    await renderFor(INSIDE_CALAMUCHITA);
    await findButton();

    await act(async () => {
      fireEvent.press(screen.getByTestId('map-download-button'));
    });
    await waitFor(() => expect(screen.getByTestId('map-download-button-error')).toBeTruthy());

    // Our own line, never the platform's message.
    expect(screen.getByText("We couldn't download the map. Try again.")).toBeTruthy();
    expect(screen.queryByText(/ENOSPC/)).toBeNull();

    // The failure is retryable: the same action is still there to be tapped.
    expect(screen.getByTestId('map-download-button')).not.toBeDisabled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('map-download-button'));
    });

    await waitFor(() => expect(mockedEnsureOnDisk).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Map available offline')).toBeTruthy());
    expect(screen.queryByTestId('map-download-button-error')).toBeNull();
  });

  it('is announced as a labelled, testable action', async () => {
    await renderFor(INSIDE_CALAMUCHITA);
    await findButton();

    const button = screen.getByLabelText('Prepare this map');
    expect(button.props.testID).toBe('map-download-button');
  });
});
