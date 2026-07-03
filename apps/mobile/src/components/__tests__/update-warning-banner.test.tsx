import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UpdateWarningBanner } from '../update-warning-banner';

describe('UpdateWarningBanner', () => {
  it('renders the banner with i18n title', async () => {
    await render(<UpdateWarningBanner />);
    expect(screen.getByText('versionCheck.bannerTitle')).toBeTruthy();
  });

  it('renders the banner message', async () => {
    await render(<UpdateWarningBanner />);
    expect(screen.getByText('versionCheck.bannerMessage')).toBeTruthy();
  });

  it('renders a dismiss button', async () => {
    await render(<UpdateWarningBanner />);
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

    fireEvent.press(dismissButton);

    // After dismiss, the banner should no longer be rendered
    expect(screen.queryByTestId('update-warning-banner')).toBeNull();
  });

  it('has accessible dismiss button with accessibility label', async () => {
    await render(<UpdateWarningBanner />);
    const dismissButton = screen.getByTestId('update-banner-dismiss-button');
    expect(dismissButton).toBeTruthy();
    // Accessibility label should match the dismiss text
    expect(dismissButton.props.accessibilityLabel).toBeDefined();
  });
});
