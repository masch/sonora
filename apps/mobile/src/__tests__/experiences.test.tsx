import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ExperiencesScreen from '@/app/(tabs)/experiences';

const mockThemes = [
  { key: 'birds', labelKey: 'experiences.categories.birds', order: 1 },
  { key: 'stories', labelKey: 'experiences.categories.stories', order: 2 },
  { key: 'landscapes', labelKey: 'experiences.categories.landscapes', order: 3 },
  { key: 'poems', labelKey: 'experiences.categories.poems', order: 4 },
  { key: 'community', labelKey: 'experiences.categories.community', order: 5 },
  { key: 'children', labelKey: 'experiences.categories.children', order: 6 },
];

const mockExperiences = [
  {
    id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    slug: 'tacuarita-azul',
    title: 'Tacuarita Azul',
    description: 'Paisaje sonoro',
    format: 'track',
    themeKey: 'landscapes',
    audioUrl: 'https://example.com/audio3.mp3',
    durationSeconds: 240,
    latitude: -32.2115,
    longitude: -64.7385,
    imageKey: 'tacuarita-azul',
    isDownloadable: true,
  },
  {
    id: '2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    slug: 'el-arroyo',
    title: 'El arroyo',
    description: 'Historia',
    format: 'track',
    themeKey: 'stories',
    audioUrl: 'https://example.com/audio4.mp3',
    durationSeconds: 420,
    latitude: -32.212,
    longitude: -64.739,
    imageKey: 'el-arroyo',
    isDownloadable: true,
  },
];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/data/experiences', () => ({
  EXPERIENCE_FORMATS: ['track', 'trip'] as const,
  fetchThemes: jest.fn(() => Promise.resolve(mockThemes)),
  fetchExperiences: jest.fn(() => Promise.resolve(mockExperiences)),
}));

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'experiences.title': 'Experiences',
        'experiences.searchPlaceholder.track': 'Search tracks...',
        'experiences.searchPlaceholder.trip': 'Search trips...',
        'experiences.categories.all': 'All',
        'experiences.categories.birds': 'Birds',
        'experiences.categories.stories': 'Stories',
        'experiences.categories.landscapes': 'Landscapes',
        'experiences.categories.poems': 'Poems',
        'experiences.categories.community': 'Community',
        'experiences.categories.children': 'Children',
        'experiences.types.track': 'Tracks',
        'experiences.types.trip': 'Trips',
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

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

describe('ExperiencesScreen', () => {
  it('renders all layout elements correctly', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(<ExperiencesScreen />);

    await waitFor(() => {
      expect(getByTestId('type-chip-track')).toBeTruthy();
    });

    expect(getByPlaceholderText('Search tracks...')).toBeTruthy();

    expect(getByTestId('category-chip-all')).toBeTruthy();
    expect(getByText('Birds')).toBeTruthy();
    expect(getByText('Stories')).toBeTruthy();
    expect(getByText('Landscapes')).toBeTruthy();

    expect(getByText('Tacuarita Azul')).toBeTruthy();
    expect(getByText('El arroyo')).toBeTruthy();
  });

  it('filters tracks by search query', async () => {
    const { getByPlaceholderText, queryByText } = render(<ExperiencesScreen />);

    await waitFor(() => {
      expect(getByPlaceholderText('Search tracks...')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search tracks...');
    fireEvent.changeText(searchInput, 'arroyo');

    expect(queryByText('El arroyo')).toBeTruthy();
    expect(queryByText('Tacuarita Azul')).toBeNull();
  });

  it('filters tracks by theme chip selection', async () => {
    const { getByText, queryByText } = render(<ExperiencesScreen />);

    await waitFor(() => {
      expect(getByText('Landscapes')).toBeTruthy();
    });

    const landscapesChip = getByText('Landscapes');
    fireEvent.press(landscapesChip);

    expect(queryByText('Tacuarita Azul')).toBeTruthy();
    expect(queryByText('El arroyo')).toBeNull();
  });
});
