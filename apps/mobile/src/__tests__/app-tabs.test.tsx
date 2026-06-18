import React from 'react';
import { render } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import AppTabsNative from '@/components/app-tabs';

// Mock NativeTabs from expo-router for isolated testing.
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

jest.mock('expo-router/unstable-native-tabs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView, Text: RNText } = require('react-native');

  const NativeTabsMock = (props: Record<string, unknown>) => (
    <RNView {...props} testID="native-tabs">
      {props.children as React.ReactNode}
    </RNView>
  );
  NativeTabsMock.displayName = 'NativeTabs';

  const Trigger = ({ children, name }: { children?: React.ReactNode; name: string }) => (
    <RNView testID={`native-trigger-${name}`}>{children}</RNView>
  );
  Trigger.displayName = 'Trigger';

  const Label = ({ children }: { children?: React.ReactNode }) => <RNText>{children}</RNText>;
  Label.displayName = 'Label';

  const Icon = () => null;
  Icon.displayName = 'Icon';

  Trigger.Label = Label;
  Trigger.Icon = Icon;
  NativeTabsMock.Trigger = Trigger;

  return { NativeTabs: NativeTabsMock };
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

describe('Native app-tabs', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<AppTabsNative />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders triggers for visible (index and tracks) tabs', () => {
    const { getByTestId } = render(<AppTabsNative />);
    expect(getByTestId('native-trigger-index')).toBeTruthy();
    expect(getByTestId('native-trigger-tracks')).toBeTruthy();
  });

  it('does NOT render trigger for hidden (explore) tab', () => {
    const { queryByTestId } = render(<AppTabsNative />);
    expect(queryByTestId('native-trigger-explore')).toBeNull();
  });

  it('does NOT render trigger for hidden (settings) tab', () => {
    const { queryByTestId } = render(<AppTabsNative />);
    expect(queryByTestId('native-trigger-settings')).toBeNull();
  });
});
