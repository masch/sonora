import React from 'react';
import { render } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import AppTabsWeb from '@/components/app-tabs.web';

// Mock expo-router/ui Tabs components for isolated testing.
// Uses require() inside factory because jest.mock is hoisted above imports.
jest.mock('@/constants/tabs', () => ({
  TABS: [
    {
      name: 'index',
      label: 'Home',
      ioniconsName: 'home-outline',
      symbolViewName: { ios: 'house', android: 'home', web: 'home' },
      hidden: false,
    },
    {
      name: 'tracks',
      label: 'Tracks',
      ioniconsName: 'musical-notes-outline',
      symbolViewName: { ios: 'music.note.list', android: 'library_music', web: 'library_music' },
      hidden: false,
    },
    {
      name: 'explore',
      label: 'Explore',
      ioniconsName: 'compass-outline',
      symbolViewName: { ios: 'compass.drawing', android: 'explore', web: 'explore' },
      hidden: true,
    },
    {
      name: 'settings',
      label: 'Settings',
      ioniconsName: 'settings-outline',
      symbolViewName: { ios: 'gear', android: 'settings', web: 'settings' },
      hidden: true,
    },
  ],
}));

jest.mock('expo-router/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native');
  return {
    Tabs: ({ children }: { children: React.ReactNode }) => <RNView>{children}</RNView>,
    TabList: ({ children, ...props }: Record<string, unknown>) => (
      <RNView {...props}>{children as React.ReactNode}</RNView>
    ),
    TabSlot: ({ style }: { style?: Record<string, unknown> }) => <RNView style={style} />,
    TabTrigger: ({ children, name, ...props }: Record<string, unknown>) => (
      <RNView {...props} testID={`tab-trigger-${name as string}`}>
        {children as React.ReactNode}
      </RNView>
    ),
  };
});

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation(
    (key: string) =>
      ({
        'tabs.index': 'Home',
        'tabs.tracks': 'Tracks',
        'tabs.explore': 'Explore',
        'tabs.settings': 'Settings',
      })[key] ?? key,
  );
});

describe('Web app-tabs', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<AppTabsWeb />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders TabTrigger for visible (index and tracks) tabs', () => {
    const { getByTestId } = render(<AppTabsWeb />);
    expect(getByTestId('tab-trigger-index')).toBeTruthy();
    expect(getByTestId('tab-trigger-tracks')).toBeTruthy();
  });

  it('does NOT render TabTrigger for hidden (explore) tab', () => {
    const { queryByTestId } = render(<AppTabsWeb />);
    expect(queryByTestId('tab-trigger-explore')).toBeNull();
  });

  it('does NOT render TabTrigger for hidden (settings) tab', () => {
    const { queryByTestId } = render(<AppTabsWeb />);
    expect(queryByTestId('tab-trigger-settings')).toBeNull();
  });
});
