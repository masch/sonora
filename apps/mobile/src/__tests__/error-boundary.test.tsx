import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  usePathname: () => '/trip/abc',
  Stack: { Screen: () => null },
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  DarkTheme: {},
  DefaultTheme: {},
}));

jest.mock('../services/analytics', () => ({
  AnalyticsService: {
    recordError: jest.fn(),
    initializeGlobalErrorTracking: jest.fn(),
  },
}));

import { ErrorBoundary } from '../app/_layout';
import { AnalyticsService } from '../services/analytics';
import { errorReference } from '../utils/error-reference';

const globalScope = globalThis as { __DEV__?: boolean };
const originalDev = globalScope.__DEV__;

describe('ErrorBoundary component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalScope.__DEV__ = originalDev;
  });

  it('renders the friendly title, the hint and the error reference, and hides the raw message outside dev', async () => {
    globalScope.__DEV__ = false;
    const error = new Error('Test crash error message');

    await render(<ErrorBoundary error={error} retry={jest.fn()} />);

    expect(screen.getByText('common.somethingWentWrong')).toBeTruthy();
    expect(screen.getByText('common.errorHint')).toBeTruthy();
    expect(screen.getByText('common.errorReference')).toBeTruthy();
    expect(screen.getByText(errorReference(error))).toBeTruthy();
    expect(screen.getByTestId('error-reference')).toBeTruthy();
    expect(screen.queryByTestId('error-message')).toBeNull();
  });

  it('reports the crash once with the description and the reference the walker can read', async () => {
    const error = new Error('Test crash error message');

    await render(<ErrorBoundary error={error} retry={jest.fn()} />);

    expect(AnalyticsService.recordError).toHaveBeenCalledTimes(1);
    expect(AnalyticsService.recordError).toHaveBeenCalledWith(
      error,
      'Root ErrorBoundary caught layout/render error',
      { reference: errorReference(error), route: '/trip/abc', fatal: true },
    );
  });

  it('triggers retry on press', async () => {
    const mockRetry = jest.fn();

    await render(<ErrorBoundary error={new Error('boom')} retry={mockRetry} />);
    await fireEvent.press(screen.getByTestId('retry-button'));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('navigates to the app root from the go-home button', async () => {
    await render(<ErrorBoundary error={new Error('boom')} retry={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('error-go-home'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('falls back to re-rendering when there is no navigator to go home to', async () => {
    // The boundary renders instead of the root layout, so the very crash it exists
    // for can be one where `Stack` never mounted. Expo Router throws in that state,
    // and a button that throws would leave the walker with no working action.
    mockReplace.mockImplementationOnce(() => {
      throw new Error('Attempted to navigate before mounting the Root Layout component');
    });
    const mockRetry = jest.fn();

    await render(<ErrorBoundary error={new Error('boom')} retry={mockRetry} />);
    await fireEvent.press(screen.getByTestId('error-go-home'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});
