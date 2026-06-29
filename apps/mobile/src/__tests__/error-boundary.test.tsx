import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ErrorBoundary } from '../app/_layout';
import { AnalyticsService } from '../services/analytics';

jest.mock('../services/analytics', () => ({
  AnalyticsService: {
    recordError: jest.fn(),
    initializeGlobalErrorTracking: jest.fn(),
  },
}));

describe('ErrorBoundary component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders error message, tracks error, and triggers retry on press', () => {
    const mockRetry = jest.fn();
    const error = new Error('Test crash error message');

    render(<ErrorBoundary error={error} retry={mockRetry} />);

    // Verify error messages and layout content
    expect(screen.getByText('Test crash error message')).toBeTruthy();

    // Verify analytics tracking was called
    expect(AnalyticsService.recordError).toHaveBeenCalledWith(
      error,
      'Root ErrorBoundary caught layout/render error',
    );

    // Verify retry button click
    const retryBtn = screen.getByTestId('retry-button');
    fireEvent.press(retryBtn);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});
