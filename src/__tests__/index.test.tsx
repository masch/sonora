import React from 'react';
import { render } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import HomeScreen from '@/app/index';

jest.mock('expo-device', () => ({ isDevice: false }));

const mockMap: Record<string, string> = {
  'index.title': 'Welcome to Expo',
  'index.getStarted': 'get started',
  'index.hints.editing': 'Try editing',
  'index.hints.devtools': 'Dev tools',
  'index.hints.freshStart': 'Fresh start',
  'index.hints.devtoolsWeb': 'use browser devtools',
  'index.hints.devtoolsDevice': 'shake device or press m in terminal',
  'index.hints.devtoolsAndroid': 'press cmd+m (or ctrl+m)',
  'index.hints.devtoolsIos': 'press cmd+d',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

describe('Home screen', () => {
  it('renders the title', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Welcome to Expo')).toBeTruthy();
  });

  it('renders the get started badge', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('get started')).toBeTruthy();
  });

  it('renders all HintRow titles', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Try editing')).toBeTruthy();
    expect(getByText('Dev tools')).toBeTruthy();
    expect(getByText('Fresh start')).toBeTruthy();
  });
});
