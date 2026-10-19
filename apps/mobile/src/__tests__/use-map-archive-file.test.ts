import { act, renderHook, waitFor } from '@testing-library/react-native';

/**
 * An in-memory stand-in for the installed `expo-file-system` 56.0.8 class API.
 *
 * The hook only needs `Paths.document`, `Directory.create`, `File.exists`,
 * `File.size`, `File.delete`, `File.move`, `File.open` with `FileHandle.readBytes`,
 * `File.downloadFileAsync` and `File.uri`, so the double keeps exactly those and
 * records what really landed on the fake device disk.
 *
 * The disk stores contents, not just names, because the hook reads the first bytes
 * back before it publishes. A transfer writes into the file it opened when it
 * started, the way a streaming download does, so a run that loses that file
 * mid-transfer cannot publish as if nothing happened — which is exactly the
 * interference a second run of the same archive has to be kept out of. A failed
 * transfer leaves the bytes it streamed at its destination, so the hook cannot fake
 * a clean failure by accident.
 */
interface MockInode {
  bytes: Uint8Array;
}

const mockDisk = new Map<string, MockInode>();
const mockDownloadUrls: string[] = [];
let mockDownloadFailure: Error | null = null;
let mockDownloadGate: Promise<void> | null = null;
let mockDownloadBytes: Uint8Array | null = null;
let mockMoveFailure: Error | null = null;

/** Bytes of a string, as a download body would deliver them. */
function mockBytesOf(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

/** Header fields a test may bend; the defaults describe an archive that fits `size`. */
interface MockHeader {
  version?: number;
  rootDirOffset?: number;
  rootDirLength?: number;
  tileDataOffset?: number;
  tileDataLength?: number;
}

/** A little-endian uint64, written as the two uint32 halves the format stores. */
function mockUint64(body: Uint8Array, offset: number, value: number): void {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  view.setUint32(offset, value % 2 ** 32, true);
  view.setUint32(offset + 4, Math.floor(value / 2 ** 32), true);
}

/**
 * An archive body the hook must publish: the 127-byte v3 header, with a root
 * directory and tile data laid out inside `size` bytes. `header` bends one field at
 * a time, which is how the rejection cases are written.
 */
function mockArchiveBody(size = 4096, header: MockHeader = {}): Uint8Array {
  const body = new Uint8Array(size);
  body.set(mockBytesOf('PMTiles'));
  body[7] = header.version ?? 3;
  const rootDirOffset = 127;
  const rootDirLength = 64;
  const tileDataOffset = rootDirOffset + rootDirLength;
  mockUint64(body, 8, header.rootDirOffset ?? rootDirOffset);
  mockUint64(body, 16, header.rootDirLength ?? rootDirLength);
  mockUint64(body, 56, header.tileDataOffset ?? tileDataOffset);
  mockUint64(body, 64, header.tileDataLength ?? size - tileDataOffset);
  return body;
}

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
      return mockDisk.get(this.uri)?.bytes.length ?? 0;
    }

    delete() {
      mockDisk.delete(this.uri);
    }

    open() {
      const inode = mockDisk.get(this.uri);
      if (!inode) throw new Error(`no such file: ${this.uri}`);
      let offset = 0;
      return {
        offset,
        size: inode.bytes.length,
        readBytes: (length: number) => {
          const chunk = inode.bytes.slice(offset, offset + length);
          offset += chunk.length;
          return chunk;
        },
        writeBytes: () => {},
        close: () => {},
      };
    }

    async move(destination: MockFile, options?: { overwrite?: boolean }) {
      // A device that is out of space or out of permissions rejects here, before
      // the archive path is touched.
      if (mockMoveFailure) throw mockMoveFailure;
      const inode = mockDisk.get(this.uri);
      if (!inode) throw new Error(`no such file: ${this.uri}`);
      if (mockDisk.has(destination.uri) && !options?.overwrite) {
        throw new Error(`DestinationAlreadyExists: ${destination.uri}`);
      }
      mockDisk.delete(this.uri);
      mockDisk.set(destination.uri, inode);
      this.uri = destination.uri;
    }

    static downloadFileAsync = jest.fn(async (url: string, destination: MockFile) => {
      mockDownloadUrls.push(url);
      // The transfer creates its destination when it starts and then streams into
      // that inode: if another run deletes or replaces the file meanwhile, the
      // bytes arrive nowhere instead of resurrecting a name this run lost.
      const inode: MockInode = { bytes: new Uint8Array(0) };
      mockDisk.set(destination.uri, inode);
      if (mockDownloadGate) await mockDownloadGate;
      if (mockDownloadFailure) {
        inode.bytes = mockArchiveBody().slice(0, 512);
        throw mockDownloadFailure;
      }
      inode.bytes = mockDownloadBytes ?? mockArchiveBody();
      return destination;
    });
  }

  return {
    Paths: { document: new MockDirectory('file:///document') },
    Directory: MockDirectory,
    File: MockFile,
    // The hook opens the downloaded file read-only to check its first bytes.
    FileMode: { ReadOnly: 'r' },
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
    mockDownloadBytes = null;
    mockMoveFailure = null;
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

  it('releases the downloaded file when publishing the archive fails', async () => {
    const first = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const cachedFile = fileOf(first.result.current.uri);

    // Out of space or out of permissions: the move onto the archive path rejects
    // after the whole archive has already been downloaded.
    mockMoveFailure = new Error('ENOSPC: no space left on device');
    const second = await renderHook(() => useMapArchiveFile(ARCHIVE_V2));
    await waitFor(() => expect(second.result.current.status).toBe('error'));

    expect(second.result.current.uri).toBeUndefined();
    expect(second.result.current.error).toBe('ENOSPC: no space left on device');
    // The finished download was released instead of being kept as the largest file
    // this app writes, and the archive that was already usable is untouched.
    expect([...mockDisk.keys()]).toEqual([cachedFile]);
  });

  it('lets two concurrent downloads of one archive publish the same file', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    mockDownloadGate = gate;

    const first = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    const second = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));

    // Both really transfer, and both are still in flight: each run owns its
    // temporary file, so neither can delete or overwrite what the other is writing.
    expect(mockDownloadUrls).toEqual([ARCHIVE_V1, ARCHIVE_V1]);

    release();
    await act(async () => {
      await gate;
    });

    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    // The second run loses the race for the download but not the archive: both
    // point at the one published file.
    expect(second.result.current.uri).toBe(first.result.current.uri);
    expect([...mockDisk.keys()]).toEqual([fileOf(first.result.current.uri)]);
  });

  it('rejects an empty download without publishing anything', async () => {
    mockDownloadBytes = new Uint8Array(0);

    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('downloaded archive is empty');
    expect(result.current.uri).toBeUndefined();
    // The empty file was deleted rather than published under the archive's name.
    expect([...mockDisk.keys()]).toEqual([]);
  });

  it('rejects a download that is not a PMTiles archive without publishing it', async () => {
    // An error page or a proxy's HTML answer arriving where the archive should be.
    mockDownloadBytes = mockBytesOf('<html><body>404 Not Found</body></html>');

    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('downloaded archive is not a PMTiles archive');
    expect(result.current.uri).toBeUndefined();
    expect([...mockDisk.keys()]).toEqual([]);
  });

  it('publishes a v3 archive whose header and tile data fit the file', async () => {
    mockDownloadBytes = mockArchiveBody();

    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect([...mockDisk.keys()]).toEqual([fileOf(result.current.uri)]);
  });

  it('rejects a body whose tile data ends beyond the file size', async () => {
    // The magic is there, so the transfer started as a real archive but the body
    // stopped early: publishing it would break every read that follows.
    mockDownloadBytes = mockArchiveBody(4096, { tileDataLength: 8192 });

    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('downloaded archive is truncated');
    expect(result.current.uri).toBeUndefined();
    expect([...mockDisk.keys()]).toEqual([]);
  });

  it('rejects a body whose root directory ends beyond the file size', async () => {
    mockDownloadBytes = mockArchiveBody(4096, { rootDirLength: 8192 });

    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('downloaded archive is truncated');
    expect(result.current.uri).toBeUndefined();
    expect([...mockDisk.keys()]).toEqual([]);
  });

  it('rejects an archive announced as another PMTiles version', async () => {
    mockDownloadBytes = mockArchiveBody(4096, { version: 4 });

    const { result } = await renderHook(() => useMapArchiveFile(ARCHIVE_V1));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('downloaded archive has an unsupported PMTiles version');
    expect(result.current.uri).toBeUndefined();
    expect([...mockDisk.keys()]).toEqual([]);
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
