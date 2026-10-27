import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import type { MapLayerSelection } from '@sonora/shared';

import MapLayersControl from '@/components/map/map-layers-control';

/**
 * The global `react-i18next` double answers with the key and drops the options, so
 * every row would announce the same sentence and a label test would prove nothing.
 * This file's double keeps the interpolation value, the way the real `t` does, so a
 * label names the group it belongs to.
 */
beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation(
    (key: string, options?: { name?: string }) => (options?.name ? `${key}=${options.name}` : key),
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
