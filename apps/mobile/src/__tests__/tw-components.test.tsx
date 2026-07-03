import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { TwView, TwText, TwScrollView, TwPressable, TwTextInput } from '@/tw';
import { TwImage } from '@/tw/image';
import { TwAnimatedView } from '@/tw/animated';

describe('TwView', () => {
  it('renders children with className prop', async () => {
    const { getByText } = await render(
      <TwView className="flex-1 p-4">
        <TwText>Hello View</TwText>
      </TwView>,
    );
    expect(getByText('Hello View')).toBeTruthy();
  });

  it('renders nested TwView components', async () => {
    const { getByText } = await render(
      <TwView className="p-4">
        <TwView className="bg-blue-500">
          <TwText>Nested</TwText>
        </TwView>
      </TwView>,
    );
    expect(getByText('Nested')).toBeTruthy();
  });
});

describe('TwText', () => {
  it('renders text content with className', async () => {
    const { getByText } = await render(<TwText className="text-lg font-bold">Bold Text</TwText>);
    expect(getByText('Bold Text')).toBeTruthy();
  });

  it('renders with empty className', async () => {
    const { getByText } = await render(<TwText className="">Empty Class</TwText>);
    expect(getByText('Empty Class')).toBeTruthy();
  });
});

describe('TwScrollView', () => {
  it('renders children inside scroll view with className', async () => {
    const { getByText } = await render(
      <TwScrollView className="flex-1">
        <TwText>Scroll Content</TwText>
      </TwScrollView>,
    );
    expect(getByText('Scroll Content')).toBeTruthy();
  });

  it('renders multiple children', async () => {
    const { getByText } = await render(
      <TwScrollView className="p-4">
        <TwText>Item 1</TwText>
        <TwText>Item 2</TwText>
      </TwScrollView>,
    );
    expect(getByText('Item 1')).toBeTruthy();
    expect(getByText('Item 2')).toBeTruthy();
  });
});

describe('TwPressable', () => {
  it('renders children and handles press with className', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <TwPressable className="bg-blue-500 p-4" onPress={onPress}>
        <TwText>Press Me</TwText>
      </TwPressable>,
    );
    expect(getByText('Press Me')).toBeTruthy();

    await fireEvent.press(getByText('Press Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires onPress multiple times', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <TwPressable className="p-2" onPress={onPress}>
        <TwText>Multi Press</TwText>
      </TwPressable>,
    );
    await fireEvent.press(getByText('Multi Press'));
    await fireEvent.press(getByText('Multi Press'));
    expect(onPress).toHaveBeenCalledTimes(2);
  });
});

describe('TwTextInput', () => {
  it('renders and accepts value with className', async () => {
    const { getByDisplayValue } = await render(
      <TwTextInput className="border p-2" value="Hello" onChangeText={() => {}} />,
    );
    expect(getByDisplayValue('Hello')).toBeTruthy();
  });

  it('calls onChangeText when text changes', async () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = await render(
      <TwTextInput className="border p-2" value="" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(getByDisplayValue(''), 'New text');
    expect(onChangeText).toHaveBeenCalledWith('New text');
  });
});

describe('TwImage', () => {
  it('renders with className and source prop', async () => {
    const { getByTestId } = await render(
      <TwImage
        testID="test-image"
        className="w-24 h-24 rounded-lg"
        source={{ uri: 'https://example.com/image.png' }}
      />,
    );
    expect(getByTestId('test-image')).toBeTruthy();
  });

  it('renders with numeric source (require)', async () => {
    const { getByTestId } = await render(
      <TwImage
        testID="require-image"
        className="w-full h-48"
        source={1 as unknown as { uri: string }}
      />,
    );
    expect(getByTestId('require-image')).toBeTruthy();
  });
});

describe('TwAnimatedView', () => {
  it('renders children with className', async () => {
    const { getByText } = await render(
      <TwAnimatedView className="flex-1">
        <Text>Animated Content</Text>
      </TwAnimatedView>,
    );
    expect(getByText('Animated Content')).toBeTruthy();
  });

  it('renders nested views', async () => {
    const { getByText } = await render(
      <TwAnimatedView className="p-4">
        <View>
          <Text>Deeply Nested</Text>
        </View>
      </TwAnimatedView>,
    );
    expect(getByText('Deeply Nested')).toBeTruthy();
  });
});
