import { fireEvent, render, screen } from '@testing-library/react-native';

import { Chip } from '@/components/ui/chip';

/**
 * A filter chip is one toggle in a row of siblings: the only things a caller and a
 * screen reader can observe are its name, whether it is the selected one, and that a
 * press reaches the caller. Those three are what this suite pins.
 */
describe('Chip', () => {
  it('renders its label as the name a screen reader announces', async () => {
    await render(
      <Chip
        label="Paseos"
        selected={false}
        onPress={jest.fn()}
        testID="chip-paseos"
        accessibilityLabel="Paseos"
      />,
    );

    const chip = screen.getByTestId('chip-paseos');
    expect(chip).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Paseos' })).toBe(chip);
    expect(screen.getByText('Paseos')).toBeOnTheScreen();
  });

  it('announces itself as the selected one when it is selected', async () => {
    await render(
      <Chip
        label="Paseos"
        selected
        onPress={jest.fn()}
        testID="chip-paseos"
        accessibilityLabel="Paseos"
      />,
    );

    const chip = screen.getByTestId('chip-paseos');
    expect(chip).toBeSelected();
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    // A row asks for the selected chip and gets this one, not its siblings.
    expect(screen.getByRole('button', { name: 'Paseos', selected: true })).toBe(chip);
  });

  it('announces itself as not selected when it is not', async () => {
    await render(
      <Chip
        label="Paseos"
        selected={false}
        onPress={jest.fn()}
        testID="chip-paseos"
        accessibilityLabel="Paseos"
      />,
    );

    const chip = screen.getByTestId('chip-paseos');
    expect(chip).not.toBeSelected();
    expect(chip.props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByRole('button', { name: 'Paseos', selected: false })).toBe(chip);
    expect(screen.queryByRole('button', { name: 'Paseos', selected: true })).toBeNull();
  });

  it('reports a press once, so the caller owns the filter state', async () => {
    const onPress = jest.fn();
    await render(
      <Chip
        label="Paseos"
        selected={false}
        onPress={onPress}
        testID="chip-paseos"
        accessibilityLabel="Paseos"
      />,
    );

    fireEvent.press(screen.getByTestId('chip-paseos'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the accessible name independent of the visible label', async () => {
    await render(
      <Chip
        label="Todo"
        selected={false}
        onPress={jest.fn()}
        testID="chip-all"
        accessibilityLabel="Filtrar por todas las experiencias"
      />,
    );

    expect(screen.getByRole('button', { name: 'Filtrar por todas las experiencias' })).toBe(
      screen.getByTestId('chip-all'),
    );
    expect(screen.getByText('Todo')).toBeOnTheScreen();
  });
});
