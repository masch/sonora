import { mapSpritePath, mapStylePath, mapGlyphsPath } from '@sonora/shared';

/**
 * An in-memory stand-in for the installed `expo-file-system` 56.0.8 class API.
 *
 * The store needs `Paths.document`, `Directory.create`, `File.exists`, `File.write`,
 * `File.text`, `File.move`, `File.delete`, `File.parentDirectory` and
 * `File.downloadFileAsync`, so the double keeps exactly those and keeps the bytes: a
 * document is only worth anything if it can be read back, and a partial asset is only
 * detectable if the double remembers what a failed transfer streamed. It keeps no
 * directory tree — the style directory is `create`d idempotently and a path is a path —
 * so a name that the store forgets to create would still be written here. The device
 * check is what covers that, and the store creates both directories it writes into.
 */
const mockDisk = new Map<string, Uint8Array>();
/** Every url the store asked to download, with the path it landed on. */
const mockDownloads: { url: string; uri: string }[] = [];
let mockDownloadFailure: Error | null = null;
let mockDirectoryFailure: Error | null = null;

/** Bytes of a string, as a written document or a download body would deliver them. */
function mockBytesOf(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

/** The text of a body the double wrote. */
function mockTextOf(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
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

    create() {}

    list() {
      throw new Error('the style store never lists its directory');
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
    }

    async text() {
      const inode = mockDisk.get(this.uri);
      if (!inode) throw new Error(`no such file: ${this.uri}`);
      return mockTextOf(inode);
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
  cacheStyleOnDisk,
  downloadStyleAssets,
  GLYPH_RANGES,
  localizeStyle,
  persistStyle,
  planFontAssets,
  readPersistedStyle,
  rewriteStyleAssetsToDisk,
  SPRITE_PATHS,
  styleFileName,
  type StyleAssets,
} from '@/services/map-styles';
import { logger } from '@/utils/logger';

const API_ORIGIN = 'https://sonora-api-staging.sonora-api.workers.dev';
const CDN_ORIGIN = 'https://cdn.example';
const STYLE_URL = `${API_ORIGIN}${mapStylePath('v1')}`;
const CDN_STYLE_URL = `${CDN_ORIGIN}${mapStylePath('v1')}`;

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

/** The document the store persisted for a url, as the fake disk holds it. */
function persistedBytes(styleUrl: string): string | undefined {
  const name = styleFileName(styleUrl);
  const bytes = name ? mockDisk.get(`${STYLE_DIR}/${name}`) : undefined;
  return bytes ? mockTextOf(bytes) : undefined;
}

describe('styleFileName', () => {
  it('names the file after the host and the version the shared generator writes', () => {
    // The version is not in the payload: it is the segment the shared generator puts
    // before the extension, so the name is checked against that generator.
    const name = styleFileName(STYLE_URL);
    expect(name).toMatch(/^[0-9a-f]{8}-v1\.json$/);
    expect(styleFileName(`${API_ORIGIN}${mapStylePath('v7')}`)).toMatch(/-v7\.json$/);
  });

  it('is stable for the same url and separates two hosts that publish the same version', () => {
    expect(styleFileName(STYLE_URL)).toBe(styleFileName(STYLE_URL));
    // Staging, production and a CDN can publish v1 with different documents, so their
    // bytes may never answer for each other.
    expect(styleFileName(STYLE_URL)).not.toBe(styleFileName(CDN_STYLE_URL));
  });

  it('has no name for a url that does not end in a version', () => {
    expect(styleFileName(`${API_ORIGIN}/media/public/styles/light`)).toBeNull();
    expect(styleFileName('')).toBeNull();
  });
});

describe('persistStyle and readPersistedStyle', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockDownloads.length = 0;
  });

  it('writes the document under the name the url earns, and reads it back', async () => {
    const document = publishedStyle();

    expect(await persistStyle(STYLE_URL, document)).toBe(true);

    // One file, no temporary: publication is a single move onto the final name.
    expect(diskPaths()).toEqual([styleFileName(STYLE_URL) as string]);
    expect(await readPersistedStyle(STYLE_URL)).toMatchObject({
      version: 8,
      glyphs: REMOTE_GLYPHS,
    });
    // The version the url names is part of the identity: another one is another file.
    expect(await readPersistedStyle(`${API_ORIGIN}${mapStylePath('v2')}`)).toBeNull();
  });

  it('reports nothing when the device kept nothing for this url', async () => {
    expect(await readPersistedStyle(STYLE_URL)).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('refuses a document that is not one this store wrote', async () => {
    // A body without the `version` MapLibre reads first is not a style, and handing it
    // to the map as one is worse than having nothing to hand over.
    putOnDisk(styleFileName(STYLE_URL) as string, JSON.stringify({ error: 'not found' }));
    expect(await readPersistedStyle(STYLE_URL)).toBeNull();

    putOnDisk(styleFileName(STYLE_URL) as string, '{"version":');
    expect(await readPersistedStyle(STYLE_URL)).toBeNull();
  });

  it('never throws when the store cannot be read at all', async () => {
    // A device with no file access is a device that has to fetch the style: the read
    // reports absence instead of taking the map down with it.
    mockDirectoryFailure = new Error('no access to the document directory');
    try {
      expect(await readPersistedStyle(STYLE_URL)).toBeNull();
      expect(await persistStyle(STYLE_URL, publishedStyle())).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      mockDirectoryFailure = null;
    }
  });

  it('refuses to write a document for a url that names no version', async () => {
    expect(await persistStyle(`${API_ORIGIN}/media/public/styles/light`, publishedStyle())).toBe(
      false,
    );
    expect(diskPaths()).toEqual([]);
  });
});

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
});

describe('cacheStyleOnDisk', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockDownloads.length = 0;
    mockDownloadFailure = null;
  });

  it('keeps the document and the assets a cold start needs', async () => {
    await cacheStyleOnDisk(STYLE_URL, publishedStyle());

    // The document a cold start reads, with its bytes intact.
    expect(JSON.parse(persistedBytes(STYLE_URL) as string)).toMatchObject({
      version: 8,
      glyphs: REMOTE_GLYPHS,
    });
    expect(diskPaths()).toEqual([styleFileName(STYLE_URL) as string, ...allAssetPaths()].sort());
  });

  it('still keeps the document when the asset transfers fail', async () => {
    // The document is what the map draws; the assets only decide whether labels come
    // from the device. A failed font download may not cost the style itself.
    mockDownloadFailure = new Error('disk is full');

    await expect(cacheStyleOnDisk(STYLE_URL, publishedStyle())).resolves.toBeUndefined();

    expect(diskPaths()).toEqual([styleFileName(STYLE_URL) as string]);
    expect(await readPersistedStyle(STYLE_URL)).toMatchObject({ version: 8 });
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
});
