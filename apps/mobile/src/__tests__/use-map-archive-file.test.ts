import { act, renderHook, waitFor } from '@testing-library/react-native';

/**
 * An in-memory stand-in for the installed `expo-file-system` 56.0.8 class API.
 *
 * The hook only needs `Paths.document`, `Directory.create`, `File.exists`,
 * `File.delete`, `File.move`, `File.downloadFileAsync` and `File.uri`, so the double
 * keeps exactly those and records what really landed on the fake device disk.
 * A failed transfer writes a partial file at the destination, the way Android
 * streams into it, so the hook cannot fake a clean failure by accident.
 */
const mockDisk = new Map<string, number>();
const mockDownloadUrls: string[] = [];
let mockDownloadFailure: Error | null = null;
let mockDownloadGate: Promise<void> | null = null;

jest.mock('expo-file-system', () => {
  const normalise = (raw: string): string => {
    const match = raw.match(/^([a-z]+:\/\/)(.*)$/i);
    const scheme = match ? match[1] : '';
    const rest = (match ? match[2] : raw).replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return `${scheme}${rest}`;
  };
  const join = (parts: (string | { uri: string })[]): string =>
    normalise(parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/'));

  class MockDirectory {
    uri: string;

    constructor(...parts: (string | MockDirectory)[]) {
      this.uri = join(parts);
    }

    get exists() {
      return true;
    }

    create() {}
  }

  class MockFile {
    uri: string;

    constructor(...parts: (string | MockFile | MockDirectory)[]) {
      this.uri = join(parts);
    }

    get name() {
      return this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }

    get exists() {
      return mockDisk.has(this.uri);
    }

    get size() {
      return mockDisk.get(this.uri) ?? 0;
    }

    delete() {
      mockDisk.delete(this.uri);
    }

    async move(destination: MockFile | MockDirectory, options?: { overwrite?: boolean }) {
      const size = mockDisk.get(this.uri);
      if (size === undefined) throw new Error(`no such file: ${this.uri}`);
      if (mockDisk.has(destination.uri) && !options?.overwrite) {
        throw new Error(`DestinationAlreadyExists: ${destination.uri}`);
      }
      mockDisk.delete(this.uri);
      mockDisk.set(destination.uri, size);
      this.uri = destination.uri;
    }

    static downloadFileAsync = jest.fn(
      async (url: string, destination: MockFile | MockDirectory) => {
        mockDownloadUrls.push(url);
        if (mockDownloadGate) await mockDownloadGate;
        if (mockDownloadFailure) {
          mockDisk.set(destination.uri, 512);
          throw mockDownloadFailure;
        }
        mockDisk.set(destination.uri, 4096);
        return destination;
      },
    );
  }

  return {
    Paths: { document: new MockDirectory('file:///document') },
    Directory: MockDirectory,
    File: MockFile,
  };
});

import { useMapArchiveFile } from '@/hooks/use-map-archive-file';

const ARCHIVE_V1 = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
const ARCHIVE_V2 = 'https://api.example/media/public/tiles/calamuchita/v2.pmtiles';

/** The path the hook handed back, without the `pmtiles://` transport scheme. */
function fileOf(uri: string | undefined): string {
  return (uri ?? '').replace(/^pmtiles:\/\//, '');
}

describe('useMapArchiveFile', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockDownloadUrls.length = 0;
    mockDownloadFailure = null;
    mockDownloadGate = null;
    jest.clearAllMocks();
  });

  it('downloads the archive once and hands back the file it wrote', async () => {
    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockDownloadUrls).toEqual([ARCHIVE_V1]);
    // The uri is the local file, and that file is on disk.
    expect(result.current.uri).toMatch(/^pmtiles:\/\/file:\/\/\/.+\.pmtiles$/);
    expect(mockDisk.has(fileOf(result.current.uri))).toBe(true);
    // Only the finished archive: no partial file is left behind.
    expect([...mockDisk.keys()]).toEqual([fileOf(result.current.uri)]);
  });

  it('accepts an archive url that already carries the transport scheme', async () => {
    const plain = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(plain.result.current.status).toBe('ready'));

    const scheme = await renderHook(() => useMapArchiveFile(`pmtiles://${ARCHIVE_V1}`));
    await waitFor(() => expect(scheme.result.current.status).toBe('ready'));

    expect(scheme.result.current.uri).toBe(plain.result.current.uri);
    expect(mockDownloadUrls).toEqual([ARCHIVE_V1]);
  });

  it('reuses the cached file for the same archive instead of downloading again', async () => {
    const first = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const firstUri = first.result.current.uri;

    const second = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    expect(second.result.current.uri).toBe(firstUri);
    expect(mockDownloadUrls).toEqual([ARCHIVE_V1]);
  });

  it('downloads a different archive version to its own path', async () => {
    const first = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));

    const second = await renderHook(() => useMapArchiveFile(ARCHIVE_V2));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    expect(fileOf(second.result.current.uri)).not.toBe(fileOf(first.result.current.uri));
    expect(fileOf(first.result.current.uri)).toContain('v1');
    expect(fileOf(second.result.current.uri)).toContain('v2');
    expect(mockDownloadUrls).toEqual([ARCHIVE_V1, ARCHIVE_V2]);
    // Both versions stay on disk, so the previous one is still usable.
    expect([...mockDisk.keys()].sort()).toEqual(
      [fileOf(first.result.current.uri), fileOf(second.result.current.uri)].sort(),
    );
  });

  it('gives the same url on two different hosts its own file and download', async () => {
    // The tail of this path is identical on both hosts: the key may not drop the
    // host, or the second archive would silently be answered with the first's.
    const apiHost = 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles';
    const cdnHost = 'https://cdn.example/media/public/tiles/calamuchita/v1.pmtiles';

    const api = await renderHook(() => useMapArchiveFile(apiHost));
    await waitFor(() => expect(api.result.current.status).toBe('ready'));

    const cdn = await renderHook(() => useMapArchiveFile(cdnHost));
    await waitFor(() => expect(cdn.result.current.status).toBe('ready'));

    expect(fileOf(cdn.result.current.uri)).not.toBe(fileOf(api.result.current.uri));
    // Both really transferred: the second host was never served the first's file.
    expect(mockDownloadUrls).toEqual([apiHost, cdnHost]);
    expect([...mockDisk.keys()].sort()).toEqual(
      [fileOf(api.result.current.uri), fileOf(cdn.result.current.uri)].sort(),
    );
  });

  it('keeps the previous file and reports the failure when a download fails', async () => {
    const first = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const cachedFile = fileOf(first.result.current.uri);

    mockDownloadFailure = new Error('UnableToDownload: 503 Service Unavailable');
    const second = await renderHook(() => useMapArchiveFile(ARCHIVE_V2));
    await waitFor(() => expect(second.result.current.status).toBe('error'));

    // No uri at all: never a path to a file that is not there, never the remote url.
    expect(second.result.current.uri).toBeUndefined();
    expect(second.result.current.error).toContain('503');
    // The usable file from before survived, and no partial file was left next to it.
    expect([...mockDisk.keys()]).toEqual([cachedFile]);
  });

  it('says it is loading while the download runs', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    mockDownloadGate = gate;

    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));

    expect(result.current.status).toBe('loading');
    expect(result.current.uri).toBeUndefined();

    release();
    await act(async () => {
      await gate;
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockDisk.has(fileOf(result.current.uri))).toBe(true);
  });
});
