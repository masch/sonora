import { mapArchivePath } from '@sonora/shared';

import {
  archiveFileName,
  archiveIdentity,
  listArchives,
  planEviction,
  type StoredArchive,
} from '@/services/map-archives';

const API_ORIGIN = 'https://sonora-api-staging.sonora-api.workers.dev';
const API_URL = `${API_ORIGIN}${mapArchivePath('calamuchita', 'v1')}`;
const CDN_URL = `https://cdn.example${mapArchivePath('calamuchita', 'v1')}`;

/** A file name the store writes, built here so the expectations stay readable. */
function nameOf(region: string, version: string, origin: string): string {
  return `${region}-${version}-${origin}.pmtiles`;
}

/** One stored archive, for the eviction rules. */
function stored(
  region: string,
  bytes: number,
  modifiedAt?: number,
  version = 'v1',
  origin = 'aaaaaaaa',
): StoredArchive {
  return {
    name: nameOf(region, version, origin),
    region,
    version,
    origin,
    bytes,
    modificationTime: modifiedAt,
  };
}

describe('archiveIdentity', () => {
  it('reads the region from the payload and the version from the derived url', () => {
    expect(archiveIdentity(API_URL, 'calamuchita')).toEqual({
      region: 'calamuchita',
      version: 'v1',
      origin: expect.stringMatching(/^[0-9a-f]{8}$/),
    });
  });

  // The version is not in the payload: it is the segment the shared generator puts
  // before the extension, so the parse is checked against that generator rather than
  // against a hand-written url that could drift away from it.
  it('agrees with the url the shared generator produces for another version', () => {
    const url = `${API_ORIGIN}${mapArchivePath('calamuchita', 'v7')}`;
    expect(archiveIdentity(url, 'calamuchita')?.version).toBe('v7');
  });

  it('accepts the transport scheme the map source may carry', () => {
    expect(archiveIdentity(`pmtiles://${API_URL}`, 'calamuchita')?.version).toBe('v1');
  });

  it('separates two hosts that publish the same region and version', () => {
    const api = archiveIdentity(API_URL, 'calamuchita');
    const cdn = archiveIdentity(CDN_URL, 'calamuchita');
    expect(api?.origin).not.toBe(cdn?.origin);
  });

  it('has no identity without a region, because a map in no region downloads nothing', () => {
    expect(archiveIdentity(API_URL, null)).toBeNull();
    expect(archiveIdentity(API_URL, undefined)).toBeNull();
  });

  it('has no identity for a url that does not name a versioned archive', () => {
    expect(
      archiveIdentity(`${API_ORIGIN}/media/public/tiles/calamuchita/pmtiles`, 'calamuchita'),
    ).toBeNull();
    expect(archiveIdentity('', 'calamuchita')).toBeNull();
  });
});

describe('archiveFileName', () => {
  it('names the file after the three facts that identify an archive', () => {
    expect(archiveFileName({ region: 'calamuchita', version: 'v1', origin: '0123abcd' })).toBe(
      nameOf('calamuchita', 'v1', '0123abcd'),
    );
  });
});

describe('listArchives', () => {
  it('keeps the archives it wrote and drops everything else on the disk', () => {
    const archives = listArchives([
      { name: nameOf('calamuchita', 'v1', 'aaaa1111'), size: 826_000, modificationTime: 1_000 },
      { name: 'notes.txt', size: 10 },
      { name: `${nameOf('calamuchita', 'v2', 'aaaa1111')}.123-1.part`, size: 512 },
      { name: 'calamuchita.pmtiles', size: 826_000 },
    ]);

    expect(archives).toEqual([
      {
        name: nameOf('calamuchita', 'v1', 'aaaa1111'),
        region: 'calamuchita',
        version: 'v1',
        origin: 'aaaa1111',
        bytes: 826_000,
        modificationTime: 1_000,
      },
    ]);
  });

  it('keeps a region name that carries dashes whole', () => {
    const [archive] = listArchives([
      { name: nameOf('calamuchita-norte', 'v3', 'bbbb2222'), size: 1 },
    ]);
    expect(archive).toMatchObject({ region: 'calamuchita-norte', version: 'v3' });
  });

  it('reports nothing for an empty directory', () => {
    expect(listArchives([])).toEqual([]);
  });
});

describe('planEviction', () => {
  it('evicts nothing while the archives fit the budget', () => {
    expect(planEviction({ archives: [stored('a', 60), stored('b', 30)], maxBytes: 100 })).toEqual(
      [],
    );
  });

  it('evicts the least recently written archive first, and only until it fits', () => {
    const archives = [
      stored('old', 40, 1_000),
      stored('middle', 40, 2_000),
      stored('new', 40, 3_000),
    ];

    // 120 bytes against a budget of 100: dropping the oldest leaves 80.
    expect(planEviction({ archives, maxBytes: 100 })).toEqual([archives[0].name]);
  });

  it('keeps evicting through the older archives when one removal is not enough', () => {
    const archives = [
      stored('oldest', 50, 1_000),
      stored('older', 50, 2_000),
      stored('newest', 50, 3_000),
    ];

    expect(planEviction({ archives, maxBytes: 60 })).toEqual([archives[0].name, archives[1].name]);
  });

  it('never evicts the archive a map is drawing right now', () => {
    const archives = [stored('in-use', 90, 1_000), stored('spare', 90, 2_000)];

    // The map in view is the oldest, so eviction has to pass over it.
    expect(planEviction({ archives, maxBytes: 100, keep: [archives[0].name] })).toEqual([
      archives[1].name,
    ]);
  });

  it('keeps the archive in use even when the budget cannot be met without it', () => {
    const archives = [stored('in-use', 900, 1_000), stored('spare', 10, 2_000)];

    expect(planEviction({ archives, maxBytes: 100, keep: [archives[0].name] })).toEqual([
      archives[1].name,
    ]);
  });

  it('treats an archive with no modification time as the oldest, in a stable order', () => {
    const archives = [stored('timed', 40, 5_000), stored('untimed-b', 40), stored('untimed-a', 40)];

    // Without a timestamp the archive is the oldest there is; the two of them are
    // ordered by name, so the plan is the same on every run.
    expect(planEviction({ archives, maxBytes: 40 })).toEqual([archives[2].name, archives[1].name]);
  });
});
