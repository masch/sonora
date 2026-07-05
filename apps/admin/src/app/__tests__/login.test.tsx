import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('@/tw', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity, TextInput, ScrollView } = require('react-native');
  return {
    TwView: View,
    TwText: ({ className, ...props }: any) => React.createElement(Text, props),
    TwPressable: ({ className, ...props }: any) => React.createElement(TouchableOpacity, props),
    TwTextInput: ({ className, ...props }: any) => React.createElement(TextInput, props),
    TwScrollView: ScrollView,
  };
});

jest.mock('@/services/admin-api-client', () => ({
  AdminApiClient: {
    setAuthKey: jest.fn(),
  },
}));

import LoginScreen from '../login';
import { AdminApiClient } from '@/services/admin-api-client';

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = await render(<LoginScreen />);

    expect(getByText('SONORA ADMIN')).toBeTruthy();
    expect(getByText('API Admin Key')).toBeTruthy();
    expect(getByPlaceholderText('bearer_token_key...')).toBeTruthy();
    expect(getByTestId('login-button')).toBeTruthy();
  });

  it('shows error message if key is submitted empty', async () => {
    const { getByTestId, getByText } = await render(<LoginScreen />);

    const button = getByTestId('login-button');

    await act(async () => {
      button.props.onClick();
    });

    expect(getByText('Please enter your API Key')).toBeTruthy();
    expect(AdminApiClient.setAuthKey).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('saves token and redirects on valid input submit', async () => {
    const { getByPlaceholderText, getByTestId } = await render(<LoginScreen />);

    const input = getByPlaceholderText('bearer_token_key...');
    const button = getByTestId('login-button');

    await act(async () => {
      input.props.onChangeText('test-secret-api-key');
    });

    await act(async () => {
      button.props.onClick();
    });

    expect(AdminApiClient.setAuthKey).toHaveBeenCalledWith('test-secret-api-key');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
