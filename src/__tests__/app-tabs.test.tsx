import React from 'react';
import { render } from '@testing-library/react-native';

// Mock react-i18next with a comprehensive mock
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({ 'tabs.index': 'Home', 'tabs.explore': 'Explore', 'tabs.settings': 'Settings' })[key] ?? key,
    i18n: { language: 'en' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// Mock NativeTabs from expo-router for isolated testing.
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

  const Label = ({ children }: { children?: React.ReactNode }) => (
    <RNText>{children}</RNText>
  );
  Label.displayName = 'Label';

  const Icon = () => null;
  Icon.displayName = 'Icon';

  Trigger.Label = Label;
  Trigger.Icon = Icon;
  NativeTabsMock.Trigger = Trigger;

  return { NativeTabs: NativeTabsMock };
});

import AppTabsNative from '@/components/app-tabs';

describe('Native app-tabs', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<AppTabsNative />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders trigger labels for all 3 tabs', () => {
    const { queryByText } = render(<AppTabsNative />);
    expect(queryByText('Home')).not.toBeNull();
    expect(queryByText('Explore')).not.toBeNull();
    expect(queryByText('Settings')).not.toBeNull();
  });
  it('renders without crashing', () => {
    const { toJSON } = render(<AppTabsNative />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders trigger labels for all 3 tabs', () => {
    const { queryByText } = render(<AppTabsNative />);
    expect(queryByText('Home')).not.toBeNull();
    expect(queryByText('Explore')).not.toBeNull();
    expect(queryByText('Settings')).not.toBeNull();
  });

  it('renders triggers with correct name', () => {
    const { getByTestId } = render(<AppTabsNative />);
    expect(getByTestId('native-trigger-index')).toBeTruthy();
    expect(getByTestId('native-trigger-explore')).toBeTruthy();
    expect(getByTestId('native-trigger-settings')).toBeTruthy();
  });
});
