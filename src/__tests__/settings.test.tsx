import React from 'react';
import { render } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import SettingsScreen from '@/app/settings';

const mockMap: Record<string, string> = {
  'settings.title': 'Settings',
  'settings.subtitle': 'Manage your preferences',
  'settings.section.preferences': 'Preferences',
  'settings.section.about': 'About',
  'settings.preferences.notifications': 'Notifications',
  'settings.preferences.darkMode': 'Dark Mode',
  'settings.preferences.darkModeValue.on': 'On',
  'settings.preferences.darkModeValue.off': 'Off',
  'settings.preferences.language': 'Language',
  'settings.language.label': 'English',
  'settings.profile.name': 'John Doe',
  'settings.profile.email': 'john@example.com',
  'settings.about.version': 'Version',
  'settings.about.versionValue': '1.0.0',
  'settings.about.terms': 'Terms of Service',
  'settings.about.privacy': 'Privacy Policy',
  'settings.footer': 'Powered by Expo + NativeWind',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

describe('Settings screen', () => {
  it('renders the title and subtitle', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Manage your preferences')).toBeTruthy();
  });

  it('renders profile info', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('john@example.com')).toBeTruthy();
  });

  it('renders section headers', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Preferences')).toBeTruthy();
    expect(getByText('About')).toBeTruthy();
  });

  it('renders preference rows', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('Language')).toBeTruthy();
  });

  it('renders about section items', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Version')).toBeTruthy();
    expect(getByText('1.0.0')).toBeTruthy();
    expect(getByText('Terms of Service')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
  });
});
