/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';

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
const mockT = (k: string) => mockMap[k] ?? k;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
  Trans: ({ i18nKey }: { i18nKey?: string; children?: React.ReactNode }) => {
    if (i18nKey) return (mockT(i18nKey) ?? '') as unknown as React.ReactElement;
    return null;
  },
}));

jest.mock('expo-device', () => ({ isDevice: false }));

import HomeScreen from '@/app/index';

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
