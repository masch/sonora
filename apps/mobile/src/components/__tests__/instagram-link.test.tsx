import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InstagramLink } from '../instagram-link';

const mockOpenInstagramProfile = jest.fn();
jest.mock('@/utils/social', () => ({
  openInstagramProfile: (...args: unknown[]) => mockOpenInstagramProfile(...args),
}));

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (k: string, opts?: Record<string, string>) => `${k}:${opts?.handle ?? ''}`,
  }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

let mockHandle: string | undefined = 'sonora.derivapoetica';
jest.mock('@/store/remote-config-store', () => ({
  useRemoteConfigStore: jest.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      config: {
        social: { instagramHandle: mockHandle },
      },
    };
    return selector ? selector(state) : state;
  }),
}));

describe('InstagramLink component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandle = 'sonora.derivapoetica';
  });

  it('renders link with handle and handles press', async () => {
    const { getByTestId, getByText } = await render(<InstagramLink />);

    const button = getByTestId('home-instagram-link');
    expect(button).toBeTruthy();
    expect(getByText('home.instagramHandle:sonora.derivapoetica')).toBeTruthy();

    fireEvent.press(button);
    expect(mockOpenInstagramProfile).toHaveBeenCalledWith('sonora.derivapoetica');
  });

  it('renders nothing when instagramHandle is empty', async () => {
    mockHandle = '';
    const { queryByTestId } = await render(<InstagramLink />);

    expect(queryByTestId('home-instagram-link')).toBeNull();
  });
});
