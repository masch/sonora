/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({ 'tabs.index': 'Home', 'tabs.explore': 'Explore', 'tabs.settings': 'Settings' })[key] ?? key,
    i18n: { language: 'en' },
  }),
}));

// Mock expo-router/ui Tabs components for isolated testing.
// Use require() inside factory because jest.mock is hoisted above imports.
jest.mock('expo-router/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native');
  return {
    Tabs: ({ children }: { children: React.ReactNode }) => (
      <RNView>{children}</RNView>
    ),
    TabList: ({ children, ...props }: Record<string, unknown>) => (
      <RNView {...props}>{children as React.ReactNode}</RNView>
    ),
    TabSlot: ({ style }: { style?: Record<string, unknown> }) => (
      <RNView style={style} />
    ),
    TabTrigger: ({ children, name, ...props }: Record<string, unknown>) => (
      <RNView {...props} testID={`tab-trigger-${name as string}`}>
        {children as React.ReactNode}
      </RNView>
    ),
  };
});

import AppTabsWeb from '@/components/app-tabs.web';

describe('Web app-tabs', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<AppTabsWeb />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders TabTrigger for all 3 tabs', () => {
    const { queryByText } = render(<AppTabsWeb />);
    expect(queryByText('Home')).not.toBeNull();
    expect(queryByText('Explore')).not.toBeNull();
    expect(queryByText('Settings')).not.toBeNull();
  });

  it('renders triggers with correct href', () => {
    const { getByTestId } = render(<AppTabsWeb />);
    expect(getByTestId('tab-trigger-index')).toBeTruthy();
    expect(getByTestId('tab-trigger-explore')).toBeTruthy();
    expect(getByTestId('tab-trigger-settings')).toBeTruthy();
  });
});
