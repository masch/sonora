import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Collapsible } from '@/components/ui/collapsible';

interface MockSymbolProps {
  style?: object | unknown[];
  testID?: string;
}

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return {
    SymbolView: ({ style, testID }: MockSymbolProps) => {
      return <View testID={testID || 'mock-symbol'} style={style} />;
    },
  };
});

describe('Collapsible component', () => {
  it('renders title and toggles open state showing children', async () => {
    const { getByText, queryByText } = await render(
      <Collapsible title="Test Collapsible">
        <Text>Hidden Child Content</Text>
      </Collapsible>,
    );

    // Initial state: title rendered, children hidden
    expect(getByText('Test Collapsible')).toBeTruthy();
    expect(queryByText('Hidden Child Content')).toBeNull();

    // Tap to open
    fireEvent.press(getByText('Test Collapsible'));
    expect(getByText('Hidden Child Content')).toBeTruthy();

    // Tap to close
    fireEvent.press(getByText('Test Collapsible'));
    expect(queryByText('Hidden Child Content')).toBeNull();
  });
});
