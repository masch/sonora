import type { ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import { Icon, ICON_MAP } from '@/components/icon';

interface MockSymbolViewProps {
  name: string | { ios: string; android: string; web: string };
  size?: number;
  tintColor?: string;
  weight?: string;
  style?: ViewStyle | ViewStyle[] | undefined;
}

jest.mock('expo-symbols', () => {
  const React = jest.requireActual('react');
  const h = React.createElement;
  return {
    SymbolView: ({ name, size, tintColor, weight, style }: MockSymbolViewProps) => {
      const viewProps: Record<string, unknown> = {
        testID: 'mock-symbol-view',
        name: typeof name === 'string' ? name : JSON.stringify(name),
        size,
        tintColor,
        weight,
        style,
      };
      return h('View', viewProps);
    },
  };
});

describe('Icon component', () => {
  it('resolves generic names correctly from ICON_MAP', async () => {
    const { getByTestId } = await render(<Icon name="play" size={24} tintColor="red" />);
    const symbol = getByTestId('mock-symbol-view');

    expect(symbol.props.name).toBe(JSON.stringify(ICON_MAP.play));
    expect(symbol.props.size).toBe(24);
    expect(symbol.props.tintColor).toBe('red');
  });

  it('falls back to explicit platform keys (backward compatibility)', async () => {
    const { getByTestId } = await render(
      <Icon ios="square.fill" android="square" web="square" size={20} />,
    );
    const symbol = getByTestId('mock-symbol-view');

    expect(symbol.props.name).toBe(
      JSON.stringify({ ios: 'square.fill', android: 'square', web: 'square' }),
    );
    expect(symbol.props.size).toBe(20);
  });

  it('forwards weight and style props to SymbolView', async () => {
    const customStyle = { transform: [{ rotate: '90deg' }] };
    const { getByTestId } = await render(
      <Icon name="chevronRight" weight="bold" style={customStyle} />,
    );
    const symbol = getByTestId('mock-symbol-view');

    expect(symbol.props.weight).toBe('bold');
    expect(symbol.props.style).toEqual(customStyle);
  });
});
