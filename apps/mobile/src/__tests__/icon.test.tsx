import React from 'react';
import { render } from '@testing-library/react-native';
import { Icon, ICON_MAP } from '@/components/icon';

interface MockSymbolViewProps {
  name: string | { ios: string; android: string; web: string };
  size?: number;
  tintColor?: string;
  weight?: string;
  style?: object | unknown[];
}

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return {
    SymbolView: ({ name, size, tintColor, weight, style }: MockSymbolViewProps) => {
      return (
        <View
          testID="mock-symbol-view"
          name={typeof name === 'string' ? name : JSON.stringify(name)}
          size={size}
          tintColor={tintColor}
          weight={weight}
          style={style}
        />
      );
    },
  };
});

describe('Icon component', () => {
  it('resolves generic names correctly from ICON_MAP', () => {
    const { getByTestId } = render(<Icon name="play" size={24} tintColor="red" />);
    const symbol = getByTestId('mock-symbol-view');

    expect(symbol.props.name).toBe(JSON.stringify(ICON_MAP.play));
    expect(symbol.props.size).toBe(24);
    expect(symbol.props.tintColor).toBe('red');
  });

  it('falls back to explicit platform keys (backward compatibility)', () => {
    const { getByTestId } = render(
      <Icon ios="square.fill" android="square" web="square" size={20} />,
    );
    const symbol = getByTestId('mock-symbol-view');

    expect(symbol.props.name).toBe(
      JSON.stringify({ ios: 'square.fill', android: 'square', web: 'square' }),
    );
    expect(symbol.props.size).toBe(20);
  });

  it('forwards weight and style props to SymbolView', () => {
    const customStyle = { transform: [{ rotate: '90deg' }] };
    const { getByTestId } = render(<Icon name="chevronRight" weight="bold" style={customStyle} />);
    const symbol = getByTestId('mock-symbol-view');

    expect(symbol.props.weight).toBe('bold');
    expect(symbol.props.style).toEqual(customStyle);
  });
});
