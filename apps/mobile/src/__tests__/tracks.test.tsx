import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TracksScreen from '@/app/(tabs)/tracks';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'tracks.title': 'TRACKS',
        'tracks.searchPlaceholder': 'Search tracks...',
        'tracks.categories.all': 'All',
        'tracks.categories.birds': 'Birds',
        'tracks.categories.stories': 'Stories',
        'tracks.categories.landscapes': 'Landscapes',
        'tracks.categories.poems': 'Poems',
        'tracks.categories.community': 'Community',
        'tracks.categories.children': 'Children',
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    text: '#2b2826',
    textSecondary: '#76706b',
    background: '#f4ede2',
  }),
}));

// Mock SymbolView inside Icon
jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

describe('TracksScreen', () => {
  it('renders all layout elements correctly', () => {
    const { getByText, getByPlaceholderText } = render(<TracksScreen />);

    // Header title
    expect(getByText('TRACKS')).toBeTruthy();

    // Search input
    expect(getByPlaceholderText('Search tracks...')).toBeTruthy();

    // Category chips
    expect(getByText('All')).toBeTruthy();
    expect(getByText('Birds')).toBeTruthy();
    expect(getByText('Stories')).toBeTruthy();
    expect(getByText('Landscapes')).toBeTruthy();
    expect(getByText('Poems')).toBeTruthy();
    expect(getByText('Community')).toBeTruthy();
    expect(getByText('Children')).toBeTruthy();

    // Rendered list items
    expect(getByText('Tacuarita Azul')).toBeTruthy();
    expect(getByText('El arroyo')).toBeTruthy();
    expect(getByText('La piedra antigua')).toBeTruthy();
    expect(getByText('Viento en los chañares')).toBeTruthy();
    expect(getByText('Voces del monte')).toBeTruthy();
  });

  it('filters tracks by search query', () => {
    const { getByPlaceholderText, queryByText } = render(<TracksScreen />);

    const searchInput = getByPlaceholderText('Search tracks...');
    fireEvent.changeText(searchInput, 'arroyo');

    expect(queryByText('El arroyo')).toBeTruthy();
    expect(queryByText('Tacuarita Azul')).toBeNull();
    expect(queryByText('La piedra antigua')).toBeNull();
  });

  it('filters tracks by category chip selection', () => {
    const { getByText, queryByText } = render(<TracksScreen />);

    const landscapesChip = getByText('Landscapes');
    fireEvent.press(landscapesChip);

    expect(queryByText('Tacuarita Azul')).toBeTruthy(); // Landscape
    expect(queryByText('Viento en los chañares')).toBeTruthy(); // Landscape
    expect(queryByText('El arroyo')).toBeNull(); // Story
    expect(queryByText('La piedra antigua')).toBeNull(); // Poem
  });
});
