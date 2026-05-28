/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';

const mockMap: Record<string, string> = {
  'explore.title': 'Explore',
  'explore.subtitle': 'This starter app includes example\ncode to help you get started.',
  'explore.docLink': 'Expo documentation',
  'common.learnMore': 'Learn more',
  'explore.sections.fileRouting.title': 'File-based routing',
  'explore.sections.fileRouting.desc':
    'This app has two screens: src/app/index.tsx and src/app/explore.tsx',
  'explore.sections.fileRouting.layout':
    'The layout file in src/app/_layout.tsx sets up the tab navigator.',
  'explore.sections.platforms.title': 'Android, iOS, and web support',
  'explore.sections.images.title': 'Images',
  'explore.sections.theme.title': 'Light and dark mode components',
  'explore.sections.animations.title': 'Animations',
};
const mockT = (k: string) => mockMap[k] ?? k;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
  Trans: ({ i18nKey }: { i18nKey?: string; children?: React.ReactNode }) => {
    if (i18nKey) return (mockT(i18nKey) ?? '') as unknown as React.ReactElement;
    return null;
  },
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));

import TabTwoScreen from '@/app/explore';

describe('Explore screen', () => {
  it('renders the title', () => {
    const { getByText } = render(<TabTwoScreen />);
    expect(getByText('Explore')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<TabTwoScreen />);
    expect(getByText(/This starter app includes example/)).toBeTruthy();
  });

  it('renders the Expo documentation link', () => {
    const { getByText } = render(<TabTwoScreen />);
    expect(getByText('Expo documentation')).toBeTruthy();
  });

  it('renders all collapsible section titles', () => {
    const { getByText } = render(<TabTwoScreen />);
    expect(getByText('File-based routing')).toBeTruthy();
    expect(getByText('Android, iOS, and web support')).toBeTruthy();
    expect(getByText('Images')).toBeTruthy();
    expect(getByText('Light and dark mode components')).toBeTruthy();
    expect(getByText('Animations')).toBeTruthy();
  });
});
