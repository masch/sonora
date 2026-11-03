import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import type { MapLayerSelection } from '@sonora/shared';

import MapLayersControl from '@/components/map/map-layers-control';

/**
 * The global `react-i18next` double answers with the key and drops the options, so
 * every row would announce the same sentence and a label test would prove nothing.
 * This file's double keeps the interpolation values, the way the real `t` does, so a
 * label names the group it belongs to and the loaded-map line names its version and
 * its size.
 */
beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation(
    (key: string, options?: Record<string, string | undefined>) => {
      const values = ['name', 'version', 'size']
        .map((option) => options?.[option])
        .filter((value): value is string => Boolean(value));
      return values.length > 0 ? `${key}=${values.join(' · ')}` : key;
    },
  );
});

/**
 * Three entries, in an order only the vocabulary decides: the control renders the
 * selection it is handed, in that order, and sorts nothing of its own.
 */
const selection: MapLayerSelection[] = [
  { id: 'water', visible: false, declared: true },
  { id: 'roads', visible: true, declared: false },
  { id: 'buildings', visible: true, declared: true },
];

/** The rows as they are laid out, read back from the testID each one carries. */
function rowIds(view: RenderResult): string[] {
  return view
    .getAllByRole('checkbox')
    .map((row) => String(row.props.testID).replace('map-layer-row-', ''));
}

/** Every testID in the sheet, in the order the sheet draws it. */
function testIdsInOrder(view: RenderResult, node: unknown = view.toJSON()): string[] {
  const element = node as { props?: { testID?: unknown }; children?: unknown[] } | null;
  if (!element || typeof element !== 'object') return [];

  const own = typeof element.props?.testID === 'string' ? [element.props.testID] : [];
  const children = Array.isArray(element.children) ? element.children : [];
  return [...own, ...children.flatMap((child) => testIdsInOrder(view, child))];
}

describe('MapLayersControl', () => {
  it('renders nothing at all when the control is not allowed', async () => {
    // A control with nothing in it is worse than no control: the whole action —
    // trigger and modal — is absent, not merely disabled.
    const view = await render(
      <MapLayersControl selection={selection} onToggle={jest.fn()} allowed={false} />,
    );

    expect(view.queryByTestId('map-layers-control')).toBeNull();
    expect(view.queryAllByRole('checkbox')).toEqual([]);
    expect(view.queryByTestId('map-layer-row-water')).toBeNull();
  });

  it('opens the rows from its own trigger', async () => {
    const view = await render(
      <MapLayersControl selection={selection} onToggle={jest.fn()} allowed />,
    );

    // Nothing is drawn until the walker asks for it.
    expect(view.queryByTestId('map-layer-row-water')).toBeNull();

    await fireEvent.press(view.getByTestId('map-layers-control'));

    expect(view.getByTestId('map-layer-row-water')).toBeTruthy();
  });

  it('draws one row per entry, in the order it was handed, with the state it carries', async () => {
    const view = await render(
      <MapLayersControl selection={selection} onToggle={jest.fn()} allowed />,
    );
    await fireEvent.press(view.getByTestId('map-layers-control'));

    expect(rowIds(view)).toEqual(['water', 'roads', 'buildings']);
    expect(view.getByTestId('map-layer-row-water')).not.toBeChecked();
    expect(view.getByTestId('map-layer-row-roads')).toBeChecked();
    expect(view.getByTestId('map-layer-row-buildings')).toBeChecked();
  });

  it('reports the group a row names, and only that group', async () => {
    const onToggle = jest.fn();
    const view = await render(
      <MapLayersControl selection={selection} onToggle={onToggle} allowed />,
    );
    await fireEvent.press(view.getByTestId('map-layers-control'));

    await fireEvent.press(view.getByTestId('map-layer-row-water'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('water');
  });

  it('says which map it is drawing, from the version and size it was handed', async () => {
    const view = await render(
      <MapLayersControl
        selection={selection}
        onToggle={jest.fn()}
        allowed
        archiveVersion="v7"
        archiveBytes={908_000}
      />,
    );

    // Nothing of the line is drawn over the map: it exists in the sheet, and only there.
    expect(view.queryByTestId('map-layers-loaded-map')).toBeNull();

    await fireEvent.press(view.getByTestId('map-layers-control'));

    // The archive's own version, and the payload's size as a reader reads it.
    expect(view.getByTestId('map-layers-loaded-map')).toHaveTextContent(
      'map.layers.loadedMap=v7 · 908 KB',
    );
  });

  it('draws the loaded-map line below the group rows it describes', async () => {
    const view = await render(
      <MapLayersControl
        selection={selection}
        onToggle={jest.fn()}
        allowed
        archiveVersion="v7"
        archiveBytes={908_000}
      />,
    );
    await fireEvent.press(view.getByTestId('map-layers-control'));

    const order = testIdsInOrder(view);
    expect(order).toContain('map-layers-loaded-map');
    expect(order.indexOf('map-layers-loaded-map')).toBeGreaterThan(
      order.indexOf('map-layer-row-buildings'),
    );
  });

  it('drops the clause it cannot answer instead of printing a version or a size it does not have', async () => {
    // No parsable archive url: there is no version, and `v0` would be a version no
    // artifact ever declared. The size still is what the payload published.
    const noVersion = await render(
      <MapLayersControl
        selection={selection}
        onToggle={jest.fn()}
        allowed
        archiveVersion={null}
        archiveBytes={908_000}
      />,
    );
    await fireEvent.press(noVersion.getByTestId('map-layers-control'));
    expect(noVersion.getByTestId('map-layers-loaded-map')).toHaveTextContent(
      'map.layers.loadedMapSize=908 KB',
    );

    // The version is known and the payload priced nothing: the size is dropped, and
    // `0 B` would be a measurement nobody made.
    const noSize = await render(
      <MapLayersControl
        selection={selection}
        onToggle={jest.fn()}
        allowed
        archiveVersion="v7"
        archiveBytes={0}
      />,
    );
    await fireEvent.press(noSize.getByTestId('map-layers-control'));
    expect(noSize.getByTestId('map-layers-loaded-map')).toHaveTextContent(
      'map.layers.loadedMapVersion=v7',
    );
  });

  it('keeps only the map label when it knows neither the version nor the size', async () => {
    const view = await render(
      <MapLayersControl selection={selection} onToggle={jest.fn()} allowed archiveVersion={null} />,
    );
    await fireEvent.press(view.getByTestId('map-layers-control'));

    const line = view.getByTestId('map-layers-loaded-map');
    expect(line).toHaveTextContent('map.layers.loadedMapOnly');
    // Nothing invented, and no placeholder read as a fact.
    expect(line).not.toHaveTextContent('undefined');
    expect(line).not.toHaveTextContent('v0');
    expect(line).not.toHaveTextContent('KB');
  });

  it('names each row and its state for a screen reader', async () => {
    const view = await render(
      <MapLayersControl selection={selection} onToggle={jest.fn()} allowed />,
    );
    await fireEvent.press(view.getByTestId('map-layers-control'));

    // Every row is a checkbox, and its label is the group's own name plus whether the
    // group draws — the state a screen reader has to read, not only the check box.
    expect(view.getByTestId('map-layer-row-water').props.accessibilityRole).toBe('checkbox');
    expect(view.getByLabelText('map.layers.hidden=map.layers.water')).toBeTruthy();
    expect(view.getByLabelText('map.layers.visible=map.layers.roads')).toBeTruthy();
    expect(view.getByLabelText('map.layers.visible=map.layers.buildings')).toBeTruthy();
  });
});
