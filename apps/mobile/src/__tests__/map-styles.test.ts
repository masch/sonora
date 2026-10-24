import { mapSpritePath, mapGlyphsPath } from '@sonora/shared';

/**
 * An in-memory stand-in for the installed `expo-file-system` 56.0.8 class API.
 *
 * The asset store needs `Paths.document`, `Directory.create`, `File.exists`,
 * `File.write`, `File.move`, `File.delete`, `File.parentDirectory` and
 * `File.downloadFileAsync`, so the double keeps exactly those and keeps the bytes:
 * a file is only worth anything if it can be found again, and a partial asset is only
 * detectable if the double remembers what a failed transfer streamed. It keeps no
 * directory tree — the style directory is `create`d idempotently and a path is a path —
 * so a name that the store forgets to create would still be written here. The device
 * check is what covers that, and the store creates both directories it writes into.
 */
const mockDisk = new Map<string, Uint8Array>();
/** When each file was last written, which is what the asset sweep ages a temporary by. */
const mockTimes = new Map<string, number>();
/** Every url the store asked to download, with the path it landed on. */
const mockDownloads: { url: string; uri: string }[] = [];
let mockDownloadFailure: Error | null = null;
let mockDirectoryFailure: Error | null = null;

/** Bytes of a string, as a download body would deliver them. */
function mockBytesOf(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
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
      if (mockDirectoryFailure) throw mockDirectoryFailure;
      this.uri = join(parts);
    }

    get exists() {
      return true;
    }

    get name() {
      return this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }

    create() {}

    // One level down, the way the platform lists: the glyphs sit one directory deeper
    // than the sprite, and the sweep walks both.
    list() {
      const prefix = `${this.uri}/`;
      const entries = new Map<string, MockDirectory | MockFile>();
      const uris = [...mockDisk.keys()].sort();
      for (const uri of uris) {
        if (!uri.startsWith(prefix)) continue;
        const rest = uri.slice(prefix.length);
        const slash = rest.indexOf('/');
        entries.set(
          rest.slice(0, slash === -1 ? undefined : slash),
          slash === -1 ? new MockFile(uri) : new MockDirectory(`${prefix}${rest.slice(0, slash)}`),
        );
      }
      return [...entries.values()];
    }
  }

  class MockFile {
    uri: string;

    constructor(...parts: (string | MockFile | MockDirectory)[]) {
      this.uri = join(parts);
    }

    get name() {
      return this.uri.slice(this.uri.lastIndexOf('/') + 1);
    }

    get parentDirectory() {
      return new MockDirectory(this.uri.slice(0, this.uri.lastIndexOf('/')));
    }

    get exists() {
      return mockDisk.has(this.uri);
    }

    get size() {
      return mockDisk.get(this.uri)?.length ?? 0;
    }

    write(content: string | Uint8Array) {
      mockDisk.set(this.uri, typeof content === 'string' ? mockBytesOf(content) : content);
      mockTimes.set(this.uri, Date.now());
    }

    get modificationTime() {
      return mockTimes.get(this.uri) ?? null;
    }

    async text() {
      const inode = mockDisk.get(this.uri);
      if (!inode) throw new Error(`no such file: ${this.uri}`);
      return Array.from(inode, (byte) => String.fromCharCode(byte)).join('');
    }

    delete() {
      mockDisk.delete(this.uri);
    }

    async move(destination: MockFile, options?: { overwrite?: boolean }) {
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
      mockDownloads.push({ url, uri: destination.uri });
      // A transfer creates its destination when it starts and streams into it, so a
      // failed transfer leaves the bytes it received exactly where the store put them.
      const inode: Uint8Array = mockBytesOf('partial');
      mockDisk.set(destination.uri, inode);
      if (mockDownloadFailure) throw mockDownloadFailure;
      return destination;
    });
  }

  return {
    Paths: { document: new MockDirectory('file:///document') },
    Directory: MockDirectory,
    File: MockFile,
  };
});

jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { Directory, File, Paths } from 'expo-file-system';

import {
  downloadStyleAssets,
  GLYPH_RANGES,
  localizeStyle,
  planFontAssets,
  rewriteStyleAssetsToDisk,
  SPRITE_PATHS,
  type StyleAssets,
} from '@/services/map-styles';
import { logger } from '@/utils/logger';

const API_ORIGIN = 'https://sonora-api-staging.sonora-api.workers.dev';

/** The style directory on the fake device disk. */
const STYLE_DIR = 'file:///document/map-styles';

/** The glyphs template the published style carries, as the API rewrites it. */
const REMOTE_GLYPHS = `${API_ORIGIN}${mapGlyphsPath()}`;
/** The sprite base the published style carries. */
const REMOTE_SPRITE = `${API_ORIGIN}${mapSpritePath()}`;

/** The glyphs template the map is handed once the ranges are on the device. */
const LOCAL_GLYPHS = `${STYLE_DIR}/glyphs/{fontstack}/{range}.pbf`;
/** The sprite base the map is handed once the three files are on the device. */
const LOCAL_SPRITE = `${STYLE_DIR}/sprite`;

/**
 * A style shaped like the published one: three font stacks named three ways (a plain
 * stack, an expression and a `literal` array), text layers and four sprite icons.
 */
function publishedStyle(): StyleAssets & { version: number; layers: unknown[]; sources: object } {
  return {
    version: 8,
    glyphs: REMOTE_GLYPHS,
    sprite: REMOTE_SPRITE,
    sources: { basemap: { type: 'vector', url: 'pmtiles://https://api.example/tiles/v1.pmtiles' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
      {
        id: 'places',
        type: 'symbol',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'] },
      },
      {
        id: 'roads',
        type: 'symbol',
        layout: {
          'text-field': ['get', 'name'],
          // The zoom-dependent stack: Medium past z12, Regular below it.
          'text-font': ['step', ['zoom'], ['Noto Sans Regular'], 12, ['Noto Sans Medium']],
        },
      },
      {
        id: 'water',
        type: 'symbol',
        layout: { 'text-font': ['literal', ['Noto Sans Italic']] },
      },
      // An expression that reads the stack from the feature: no font name to plan.
      { id: 'shields', type: 'symbol', layout: { 'text-font': ['get', 'font'] } },
      { id: 'station', type: 'symbol', layout: { 'icon-image': 'station' } },
    ],
  };
}

/** The glyph path of one stack and range, relative to the style directory. */
function glyphPath(fontstack: string, range: string): string {
  return `glyphs/${fontstack}/${range}.pbf`;
}

/** Everything the published style needs, as the paths a rewrite checks. */
function allAssetPaths(): string[] {
  const stacks = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
  return [
    ...stacks.flatMap((stack) => GLYPH_RANGES.map((range) => glyphPath(stack, range))),
    ...SPRITE_PATHS,
  ];
}

/** Puts a file on the fake device disk, at a path relative to the style directory. */
function putOnDisk(path: string, text = '{}'): void {
  new File(new Directory(Paths.document, 'map-styles'), path).write(text);
}

/** Every path the fake device disk holds under the style directory, relative to it. */
function diskPaths(): string[] {
  return [...mockDisk.keys()]
    .filter((uri) => uri.startsWith(`${STYLE_DIR}/`))
    .map((uri) => uri.slice(STYLE_DIR.length + 1))
    .sort();
}

describe('planFontAssets', () => {
  it('collects every font stack the style names, however the layer writes it', () => {
    const plan = planFontAssets(publishedStyle());

    // A plain stack, both branches of a zoom expression, a `literal` stack — and
    // nothing from `['get', 'font']`, whose strings are a property path, not fonts.
    expect(plan.fontstacks).toEqual(['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic']);
  });

  it('gives every stack one file per range, so no text-font is left without glyphs', () => {
    const plan = planFontAssets(publishedStyle());

    expect(plan.ranges).toEqual([...GLYPH_RANGES]);
    expect(plan.paths).toEqual(
      plan.fontstacks.flatMap((fontstack) =>
        GLYPH_RANGES.map((range) => glyphPath(fontstack, range)),
      ),
    );
    // The claim the test is about, stated directly: every stack the style names has a
    // file for every range the store downloads.
    for (const fontstack of plan.fontstacks) {
      for (const range of GLYPH_RANGES) {
        expect(plan.paths).toContain(glyphPath(fontstack, range));
      }
    }
  });

  it('joins a multi-name stack the way MapLibre writes it into the url', () => {
    const plan = planFontAssets({
      glyphs: REMOTE_GLYPHS,
      layers: [{ layout: { 'text-font': ['Noto Sans Regular', 'Noto Sans Bold'] } }],
    });

    expect(plan.fontstacks).toEqual(['Noto Sans Regular,Noto Sans Bold']);
    expect(plan.paths[0]).toBe(glyphPath('Noto Sans Regular,Noto Sans Bold', '0-255'));
  });

  it('needs no files when the style declares no glyphs url', () => {
    // A style with no glyphs draws no labels at all, so there is nothing to download
    // and the plan says so instead of inventing a stack of files.
    const plan = planFontAssets({ ...publishedStyle(), glyphs: undefined });

    expect(plan.fontstacks).toHaveLength(3);
    expect(plan.glyphs).toEqual([]);
    expect(plan.paths).toEqual([]);
  });

  it('needs no files when the style names no font', () => {
    const plan = planFontAssets({ glyphs: REMOTE_GLYPHS, layers: [{ id: 'background' }] });

    expect(plan.fontstacks).toEqual([]);
    expect(plan.paths).toEqual([]);
  });
});

describe('rewriteStyleAssetsToDisk', () => {
  it('points both urls at the device when every file the style would request is there', () => {
    const style = publishedStyle();
    const rewrite = rewriteStyleAssetsToDisk(style, {
      baseUri: STYLE_DIR,
      present: new Set(allAssetPaths()),
    });

    expect(rewrite.glyphs).toBe(LOCAL_GLYPHS);
    expect(rewrite.sprite).toBe(LOCAL_SPRITE);
    // Everything else is the style the author published, untouched.
    expect(rewrite.sources).toEqual(style.sources);
    expect(rewrite.layers).toEqual(style.layers);
    expect(rewrite.version).toBe(8);
  });

  it('leaves the published urls when a single font range is missing', () => {
    // All or nothing: half a glyph set draws names and loses the ones in the missing
    // range, with no failure to see. The network is the better answer.
    const style = publishedStyle();
    const present = new Set(allAssetPaths());
    present.delete(glyphPath('Noto Sans Medium', '256-511'));

    const rewrite = rewriteStyleAssetsToDisk(style, { baseUri: STYLE_DIR, present });

    expect(rewrite).toBe(style);
    expect(rewrite.glyphs).toBe(REMOTE_GLYPHS);
    expect(rewrite.sprite).toBe(REMOTE_SPRITE);
  });

  it('leaves the published urls when one of the three sprite files is missing', () => {
    const style = publishedStyle();
    const present = new Set(allAssetPaths());
    present.delete('sprite@2x.png');

    expect(rewriteStyleAssetsToDisk(style, { baseUri: STYLE_DIR, present })).toBe(style);
  });

  it('rewrites the sprite on its own when the style names no glyphs', () => {
    const style = { ...publishedStyle(), glyphs: undefined };
    const rewrite = rewriteStyleAssetsToDisk(style, {
      baseUri: STYLE_DIR,
      present: new Set(SPRITE_PATHS),
    });

    expect(rewrite.sprite).toBe(LOCAL_SPRITE);
    expect(rewrite.glyphs).toBeUndefined();
  });

  it('leaves the published glyphs template when the style names no font stack', () => {
    // A `file://` glyphs template with no file behind it would draw no labels at all,
    // including the ones our own reference layers ask for, so a style whose stacks we
    // could not plan keeps the url it was published with.
    const style = {
      ...publishedStyle(),
      layers: [{ id: 'background', type: 'background' }],
    };
    const rewrite = rewriteStyleAssetsToDisk(style, {
      baseUri: STYLE_DIR,
      present: new Set(SPRITE_PATHS),
    });

    expect(rewrite.glyphs).toBe(REMOTE_GLYPHS);
    expect(rewrite.sprite).toBe(LOCAL_SPRITE);
  });

  it('leaves a style with no asset urls exactly as it is', () => {
    const style = { version: 8, glyphs: undefined, sprite: undefined };
    expect(
      rewriteStyleAssetsToDisk(style, { baseUri: STYLE_DIR, present: new Set(allAssetPaths()) }),
    ).toBe(style);
  });
});

describe('downloadStyleAssets', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockDownloads.length = 0;
    mockDownloadFailure = null;
  });

  it('downloads every font range and the three files of the sprite base', async () => {
    await downloadStyleAssets(publishedStyle());

    // One file per stack and range, from the template the style carries, with the
    // spaces of a stack name encoded in the request.
    expect(mockDownloads.map(({ url }) => url)).toEqual(
      expect.arrayContaining([
        `${API_ORIGIN}/media/public/glyphs/Noto%20Sans%20Regular/0-255.pbf`,
        `${API_ORIGIN}/media/public/glyphs/Noto%20Sans%20Italic/256-511.pbf`,
        `${REMOTE_SPRITE}.json`,
        `${REMOTE_SPRITE}.png`,
        `${REMOTE_SPRITE}@2x.png`,
      ]),
    );
    // And they landed where the rewrite looks for them.
    expect(diskPaths()).toEqual(allAssetPaths().sort());
  });

  it('downloads nothing twice', async () => {
    await downloadStyleAssets(publishedStyle());
    const first = mockDownloads.length;

    await downloadStyleAssets(publishedStyle());

    expect(mockDownloads).toHaveLength(first);
  });

  it('never throws on a failed transfer and leaves no half file behind', async () => {
    mockDownloadFailure = new Error('the connection dropped');

    await expect(downloadStyleAssets(publishedStyle())).resolves.toBeUndefined();

    // A partial file under an asset's own name would read as "present" forever and
    // point the map at bytes it cannot parse, so the transfer lands on a temporary.
    expect(diskPaths().filter((path) => path.endsWith('.part'))).toEqual([]);
    expect(diskPaths()).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does nothing for a style with no assets at all', async () => {
    await downloadStyleAssets({});

    expect(mockDownloads).toEqual([]);
    expect(diskPaths()).toEqual([]);
  });

  it('keeps the style directory to the glyph ranges and the sprite', async () => {
    // The style document is not this store's to keep: it is one document with one key
    // rule, cached by `ApiClient` on both platforms (`map-style-cache.ts`). What the
    // filesystem holds is exactly what MapLibre reads as a real path, so a document
    // written here would be a second copy of the same bytes with a second failure mode.
    await downloadStyleAssets(publishedStyle());

    expect(diskPaths()).toEqual(allAssetPaths().sort());
    // One statement of the same fact, so a stray file cannot hide behind a sorted list.
    expect(
      diskPaths().every((path) => path.startsWith('glyphs/') || SPRITE_PATHS.includes(path)),
    ).toBe(true);
  });
});

describe('localizeStyle', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockDownloads.length = 0;
    mockDownloadFailure = null;
    mockDirectoryFailure = null;
  });

  it('points the style at the files this device really holds', async () => {
    const style = publishedStyle();
    // A previous run's transfers all landed.
    await downloadStyleAssets(style);

    const localized = await localizeStyle(style);

    expect(localized.glyphs).toBe(LOCAL_GLYPHS);
    expect(localized.sprite).toBe(LOCAL_SPRITE);
  });

  it('leaves the style untouched when the device holds none of its assets', async () => {
    const style = publishedStyle();

    expect(await localizeStyle(style)).toBe(style);
  });

  it('leaves the style untouched when a range is still missing', async () => {
    const style = publishedStyle();
    for (const path of allAssetPaths()) {
      if (path === glyphPath('Noto Sans Italic', '0-255')) continue;
      putOnDisk(path);
    }

    expect(await localizeStyle(style)).toBe(style);
  });

  it('never throws when the store cannot be read', async () => {
    mockDirectoryFailure = new Error('no access to the document directory');

    const style = publishedStyle();
    await expect(localizeStyle(style)).resolves.toBe(style);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('sweeps the assets a republished style no longer asks for', async () => {
    // What a device that ran an older style holds: the files this style needs, plus a
    // stack it dropped and a range it stopped using.
    for (const path of allAssetPaths()) putOnDisk(path, 'kept');
    const dropped = glyphPath('Noto Sans Bold', '0-255');
    const unusedRange = glyphPath('Noto Sans Regular', '512-767');
    putOnDisk(dropped, 'stale');
    putOnDisk(unusedRange, 'stale');
    // Older than the grace window: a map cannot still be drawing these.
    for (const path of [dropped, unusedRange]) {
      mockTimes.set(`${STYLE_DIR}/${path}`, Date.now() - 24 * 60 * 60 * 1000 - 1000);
    }

    await localizeStyle(publishedStyle());

    // The files it needs are all still there, and the two it does not are gone: nothing
    // else would ever name them again.
    for (const path of allAssetPaths()) expect(mockDisk.has(`${STYLE_DIR}/${path}`)).toBe(true);
    expect(mockDisk.has(`${STYLE_DIR}/${dropped}`)).toBe(false);
    expect(mockDisk.has(`${STYLE_DIR}/${unusedRange}`)).toBe(false);
  });

  it('leaves an asset the map on screen may still be drawing', async () => {
    // The style that just arrived does not name this stack, but the renderer may still be
    // drawing the previous document — or fall back to it — so a file written minutes ago
    // is not dead yet.
    for (const path of allAssetPaths()) putOnDisk(path, 'kept');
    const justDropped = glyphPath('Noto Sans Bold', '0-255');
    putOnDisk(justDropped, 'recent');

    await localizeStyle(publishedStyle());

    expect(mockDisk.has(`${STYLE_DIR}/${justDropped}`)).toBe(true);
  });

  it('sweeps a killed transfer but leaves a temporary a live one may be writing', async () => {
    for (const path of allAssetPaths()) putOnDisk(path, 'kept');
    const stuck = `${glyphPath('Noto Sans Regular', '0-255')}.part`;
    const inFlight = `${glyphPath('Noto Sans Medium', '0-255')}.part`;
    putOnDisk(stuck, 'half');
    putOnDisk(inFlight, 'half');
    // An hour ago is past what a transfer of an asset can take; a fresh one may be alive.
    mockTimes.set(`${STYLE_DIR}/${stuck}`, Date.now() - 60 * 60 * 1000 - 1000);

    await localizeStyle(publishedStyle());

    expect(mockDisk.has(`${STYLE_DIR}/${stuck}`)).toBe(false);
    expect(mockDisk.has(`${STYLE_DIR}/${inFlight}`)).toBe(true);
  });

  it('sweeps nothing while the style still needs the network for its assets', async () => {
    // One range is missing, so the rewrite does not fire and the plan cannot be trusted
    // as the complete set: deleting anything now would throw away files the walker has.
    for (const path of allAssetPaths()) putOnDisk(path, 'kept');
    mockDisk.delete(`${STYLE_DIR}/${glyphPath('Noto Sans Regular', '256-511')}`);
    putOnDisk(glyphPath('Noto Sans Bold', '0-255'), 'stale-but-untouchable');

    const style = publishedStyle();
    await expect(localizeStyle(style)).resolves.toBe(style);
    expect(mockDisk.has(`${STYLE_DIR}/${glyphPath('Noto Sans Bold', '0-255')}`)).toBe(true);
  });

  it('writes no document next to the assets it localizes', async () => {
    // The whole pipeline, as a cold start runs it: whatever the disk holds after the
    // asset pass and the existence check is assets — `glyphs/**` and `sprite*`.
    await downloadStyleAssets(publishedStyle());
    await localizeStyle(publishedStyle());

    expect(
      diskPaths().every((path) => path.startsWith('glyphs/') || SPRITE_PATHS.includes(path)),
    ).toBe(true);
  });
});
