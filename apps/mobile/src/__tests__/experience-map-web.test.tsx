import { act, render, waitFor } from '@testing-library/react-native';

import type { MapDocument } from '@sonora/shared';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories run hoisted
jest.mock('pmtiles', () => require('@/test-utils/fake-maplibre').fakePmtilesModule());

import ExperienceMap from '@/components/map/experience-map.web';
import { documentKeyOfLayer } from '@/components/map/map-view.types';

import { addProtocol, mockMapInstances } from '@/test-utils/maplibre-gl-double';

const document: MapDocument = {
  key: 'umepay',
  scope: 'experience',
  collection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-64.738, -32.212] },
        properties: { labelKey: 'map.references.taller' },
      },
    ],
  },
};

const SOURCE = { archiveUrl: 'pmtiles://https://r2/zone.pmtiles' };

describe('ExperienceMap (web)', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    addProtocol.mockClear();
  });

  it('registers the pmtiles protocol and sources the archive', async () => {
    await render(<ExperienceMap source={SOURCE} overlays={[]} />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    expect(addProtocol).toHaveBeenCalledWith('pmtiles', expect.anything());

    const style = mockMapInstances[0].options.style as {
      sources: Record<string, { url: string; type: string }>;
    };
    expect(style.sources.basemap.url).toBe('pmtiles://https://r2/zone.pmtiles');
  });

  it('applies the reference documents once the map is loaded', async () => {
    await render(<ExperienceMap source={SOURCE} overlays={[document]} />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    expect(map.layers).toHaveLength(0);

    map.emit('load');

    await waitFor(() => expect(map.layers.length).toBeGreaterThan(0));
    // The fallback style carries no glyphs URL, so no label layer is added.
    expect(map.layers.map((layer: { id: string }) => layer.id)).toEqual([
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle',
    ]);
    expect(Object.keys(map.sources)).toContain('refs:umepay');
  });

  it('adds the label layer only when the style provides glyphs', async () => {
    await render(
      <ExperienceMap
        source={{
          ...SOURCE,
          style: {
            version: 8,
            glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
            sources: { basemap: { type: 'vector', url: SOURCE.archiveUrl } },
            layers: [],
          },
        }}
        overlays={[document]}
      />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    map.emit('load');

    await waitFor(() => expect(map.layers.length).toBeGreaterThan(0));
    expect(map.layers.map((layer: { id: string }) => layer.id)).toEqual([
      'refs:umepay:fill',
      'refs:umepay:line',
      'refs:umepay:circle',
      'refs:umepay:label',
    ]);
  });

  it('reports the tapped reference with its document key', async () => {
    const onFeaturePress = jest.fn();
    await render(
      <ExperienceMap source={SOURCE} overlays={[document]} onFeaturePress={onFeaturePress} />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    map.emit('load');
    map.features = [
      {
        layer: { id: 'refs:umepay:circle' },
        properties: {
          labelKey: 'map.references.taller',
          label: 'map.references.taller',
          linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
        },
      },
    ];

    map.emit('click', { point: { x: 1, y: 1 } });

    expect(onFeaturePress).toHaveBeenCalledWith({
      documentKey: 'umepay',
      labelKey: 'map.references.taller',
      label: 'map.references.taller',
      linkUrl: 'https://www.instagram.com/sonora.derivapoetica',
    });
  });

  it('ignores a tap that lands on a basemap feature', async () => {
    const onFeaturePress = jest.fn();
    await render(
      <ExperienceMap source={SOURCE} overlays={[document]} onFeaturePress={onFeaturePress} />,
    );

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const map = mockMapInstances[0];
    map.emit('load');
    map.features = [{ layer: { id: 'water' }, properties: {} }];

    map.emit('click', { point: { x: 1, y: 1 } });

    expect(onFeaturePress).not.toHaveBeenCalled();
  });
});

describe('documentKeyOfLayer', () => {
  it('reads the key out of a reference layer id and ignores foreign layers', () => {
    expect(documentKeyOfLayer('refs:umepay:circle')).toBe('umepay');
    expect(documentKeyOfLayer('water')).toBeNull();
    expect(documentKeyOfLayer('buildings')).toBeNull();
  });
});

describe('ExperienceMap (web) — lifecycle regressions', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    addProtocol.mockClear();
  });

  it('does not rebuild the map when it finishes loading', async () => {
    await render(<ExperienceMap source={SOURCE} overlays={[document]} />);
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    expect(mockMapInstances).toHaveLength(1);
  });

  it('registers the pmtiles protocol exactly once across remounts', async () => {
    const first = await render(<ExperienceMap source={SOURCE} overlays={[document]} />);
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const callsAfterFirst = addProtocol.mock.calls.length;

    await act(async () => {
      await first.unmount();
    });
    await render(<ExperienceMap source={SOURCE} overlays={[document]} />);
    await waitFor(() => expect(mockMapInstances.length).toBeGreaterThan(0));

    expect(addProtocol.mock.calls.length).toBe(callsAfterFirst);
  });

  it('removes the map instance on unmount', async () => {
    const first = await render(<ExperienceMap source={SOURCE} overlays={[document]} />);
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    const remove = jest.spyOn(mockMapInstances[0] as unknown as { remove: () => void }, 'remove');

    await act(async () => {
      await first.unmount();
    });

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('resolves overlay labels through withResolvedLabels before pushing data', async () => {
    await render(<ExperienceMap source={SOURCE} overlays={[document]} />);
    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    await act(async () => {
      mockMapInstances[0].emit('load');
    });

    const setData = mockMapInstances[0].sources['refs:umepay'].setData as jest.Mock;
    expect(setData).toHaveBeenCalled();
    const pushed = setData.mock.calls.at(-1)?.[0] as {
      features: { properties: { label?: string } }[];
    };
    expect(pushed.features[0].properties.label).toBe('map.references.taller');
  });
});
