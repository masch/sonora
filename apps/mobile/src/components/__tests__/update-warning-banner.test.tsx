import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UpdateWarningBanner } from '../update-warning-banner';
import { updateService } from '@/services/update-service';

jest.mock('@/services/update-service', () => ({
  updateService: {
    triggerUpdate: jest.fn(),
  },
}));

describe('UpdateWarningBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the banner with i18n title', async () => {
    await render(<UpdateWarningBanner />);
    expect(screen.getByText('versionCheck.bannerTitle')).toBeTruthy();
  });

  it('renders the banner message', async () => {
    await render(<UpdateWarningBanner />);
    expect(screen.getByText('versionCheck.bannerMessage')).toBeTruthy();
  });

  it('renders update and dismiss buttons', async () => {
    await render(<UpdateWarningBanner />);
    expect(screen.getByText('versionCheck.bannerUpdate')).toBeTruthy();
    expect(screen.getByText('versionCheck.bannerDismiss')).toBeTruthy();
  });

  it('has a testID for the banner container', async () => {
    await render(<UpdateWarningBanner />);
    expect(screen.getByTestId('update-warning-banner')).toBeTruthy();
  });

  it('dismisses the banner when dismiss button is pressed', async () => {
    await render(<UpdateWarningBanner />);

    const dismissButton = screen.getByTestId('update-banner-dismiss-button');
    expect(dismissButton).toBeTruthy();

    await fireEvent.press(dismissButton);

    // After dismiss, the banner should no longer be rendered
    expect(screen.queryByTestId('update-warning-banner')).toBeNull();
  });

  it('has accessible buttons with accessibility labels', async () => {
    await render(<UpdateWarningBanner />);
    const updateButton = screen.getByTestId('update-banner-update-button');
    const dismissButton = screen.getByTestId('update-banner-dismiss-button');
    expect(updateButton).toBeTruthy();
    expect(dismissButton).toBeTruthy();
    expect(updateButton.props.accessibilityLabel).toBeDefined();
    expect(dismissButton.props.accessibilityLabel).toBeDefined();
  });

  it('triggers flexible update when update button is pressed', async () => {
    await render(<UpdateWarningBanner />);
    const updateButton = screen.getByTestId('update-banner-update-button');
    await fireEvent.press(updateButton);
    expect(updateService.triggerUpdate).toHaveBeenCalledWith({ mode: 'flexible' });
  });
});
