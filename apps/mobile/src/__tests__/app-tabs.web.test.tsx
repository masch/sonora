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
      symbolViewName: { ios: 'house', android: 'home', web: 'home' },
      hidden: false,
    },
    {
      name: 'experiences',
      label: 'Experiences',
      symbolViewName: { ios: 'music.note.list', android: 'library_music', web: 'library_music' },
      hidden: false,
    },
    {
      name: 'explore',
      label: 'Explore',
      symbolViewName: { ios: 'compass.drawing', android: 'explore', web: 'explore' },
      hidden: true,
    },
    {
      name: 'settings',
      label: 'Settings',
      symbolViewName: { ios: 'gear', android: 'settings', web: 'settings' },
      hidden: true,
    },
  ],
}));

jest.mock('expo-router/ui', () => {
  const React = jest.requireActual('react');
  const h = React.createElement;
  return {
    Tabs: ({ children }: { children: React.ReactNode }) => h('View', null, children),
    TabList: ({ children, ...props }: Record<string, unknown>) =>
      h('View', props as Record<string, unknown>, children as React.ReactNode),
    TabSlot: ({ style }: { style?: Record<string, unknown> }) => h('View', { style }),
    TabTrigger: ({ children, name, ...props }: Record<string, unknown>) =>
      h('View', { ...props, testID: `tab-trigger-${name as string}` }, children as React.ReactNode),
  };
});

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation(
    (key: string) =>
      ({
        'tabs.index': 'Home',
        'tabs.experiences': 'Experiences',
        'tabs.explore': 'Explore',
        'tabs.settings': 'Settings',
      })[key] ?? key,
  );
});

describe('Web app-tabs', () => {
  it('renders without crashing', async () => {
    const { toJSON } = await render(<AppTabsWeb />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders TabTrigger for visible (index and experiences) tabs', async () => {
    const { getByTestId } = await render(<AppTabsWeb />);
    expect(getByTestId('tab-trigger-index')).toBeTruthy();
    expect(getByTestId('tab-trigger-experiences')).toBeTruthy();
  });

  it('does NOT render TabTrigger for hidden (explore) tab', async () => {
    const { queryByTestId } = await render(<AppTabsWeb />);
    expect(queryByTestId('tab-trigger-explore')).toBeNull();
  });

  it('does NOT render TabTrigger for hidden (settings) tab', async () => {
    const { queryByTestId } = await render(<AppTabsWeb />);
    expect(queryByTestId('tab-trigger-settings')).toBeNull();
  });
});
