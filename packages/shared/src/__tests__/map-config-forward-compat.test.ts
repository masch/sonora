import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  DEFAULT_REMOTE_CONFIG,
  MapConfigSchema,
  MapDownloadPolicySchema,
  MapRegionPayloadSchema,
  MapRendererSchema,
} from '../schemas/config';

const region = {
  bbox: [-64.83, -32.28, -64.66, -32.12] as [number, number, number, number],
  label: 'Valle de Calamuchita',
  archiveUrl: 'https://api.example/media/public/tiles/calamuchita/v1.pmtiles',
  archiveBytes: 1_234_567,
};

const download = {
  preload: ['calamuchita'],
  autoMaxBytes: 8_000_000,
  cacheMaxBytes: 100_000_000,
  cellular: 'ask' as const,
};

const styleUrl = 'https://api.example/media/public/styles/v1.json';

/** A complete `map` as the server serves it today, plus a field no build knows. */
const mapWithUnknownField = {
  renderer: 'maplibre',
  styleUrl,
  regions: { calamuchita: region },
  download,
  futureField: { anything: true },
};

const parsedUnknownField = MapConfigSchema.safeParse(mapWithUnknownField);
if (!parsedUnknownField.success) {
  throw new Error('the current schema must accept the fixture');
}

/** The tolerant `map` a build with this schema gets out of the payload above. */
const configWithUnknownField = parsedUnknownField.data;

/**
 * The schema published builds carry, rebuilt here from the exported sub-schemas.
 *
 * It is the pre-change `map` contract: the same fields, no `layers`, `.strict()`.
 * A test that only asserted the tolerant schema would pass even if the change
 * under test were reverted, so the same payload goes through this one as well and
 * must be refused.
 */
const preChangeStrictMapSchema = z
  .object({
    renderer: MapRendererSchema,
    styleUrl: z.string(),
    regions: z.record(z.string(), MapRegionPayloadSchema),
    download: MapDownloadPolicySchema,
  })
  .strict();

/** The served `map` with only the layer selection replaced. */
function withLayers(layers: unknown): Record<string, unknown> {
  return {
    renderer: 'maplibre',
    styleUrl,
    regions: { calamuchita: region },
    download,
    layers,
  };
}

describe('map contract forward compatibility', () => {
  it('keeps renderer, styleUrl, regions and download when an unknown nested field arrives', () => {
    // The guarantee the tolerant schema buys: the server may add a field to `map`
    // before every published build knows it, and the build still draws the map
    // with the renderer, style, catalog and download policy it received.
    expect(configWithUnknownField.renderer).toBe('maplibre');
    expect(configWithUnknownField.styleUrl).toBe(styleUrl);
    expect(configWithUnknownField.regions).toEqual({ calamuchita: region });
    expect(configWithUnknownField.download).toEqual(download);
    // The unknown key is tolerated and carried, never dropped and never rejected.
    expect((configWithUnknownField as Record<string, unknown>).futureField).toEqual({
      anything: true,
    });
  });

  it('loses the whole map under the pre-change strict schema', () => {
    const strict = preChangeStrictMapSchema.safeParse(mapWithUnknownField);

    expect(strict.success).toBe(false);
    if (!strict.success) {
      expect(strict.error.issues[0]?.code).toBe('unrecognized_keys');
    }
    // The same payload the current schema parsed whole above.
    expect(MapConfigSchema.safeParse(mapWithUnknownField).success).toBe(true);
  });

  it('accepts a layer group id the build does not implement yet', () => {
    // `id` is an open string, not an enum: the server announces a group before
    // the app can draw it, and the consumer ignores what it does not implement.
    const result = MapConfigSchema.safeParse(
      withLayers({ showControl: true, groups: [{ id: 'future-group', defaultVisible: false }] }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layers.groups).toEqual([{ id: 'future-group', defaultVisible: false }]);
    }
  });

  it('still refuses an unknown key inside a region and inside the download policy', () => {
    // Tolerance stops at the nodes whose shape broke cleanly: a region and the
    // download policy are strict, so a stray key there is a contract error, not a
    // field to carry.
    expect(MapRegionPayloadSchema.safeParse({ ...region, stray: true }).success).toBe(false);
    expect(MapDownloadPolicySchema.safeParse({ ...download, stray: true }).success).toBe(false);
  });

  it('materializes the layer selection when the payload omits it', () => {
    const { layers: _omitted, ...mapWithoutLayers } = DEFAULT_REMOTE_CONFIG.map;
    const result = MapConfigSchema.safeParse(mapWithoutLayers);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layers).toEqual({ showControl: false, groups: [] });
    }
    // The compiled floor carries the same value, so an untouched config changes
    // nothing and an absent wire field is not a missing one.
    expect(DEFAULT_REMOTE_CONFIG.map.layers).toEqual({ showControl: false, groups: [] });
  });

  it('rejects a malformed selection instead of defaulting it away', () => {
    // A default only fills an absence. Whatever the payload did say must be valid,
    // or the control would show something the server never asked for.
    const malformed: unknown[] = [
      { showControl: 'true' },
      { groups: [{ id: '', defaultVisible: true }] },
      { groups: [{ id: 'osm-standard', defaultVisible: 'yes' }] },
      null,
    ];

    for (const layers of malformed) {
      const parsed = MapConfigSchema.safeParse(withLayers(layers));
      expect({ layers, success: parsed.success }).toEqual({ layers, success: false });
    }
  });
});
