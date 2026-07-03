import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { UpdateRequiredModal } from '../update-required-modal';

describe('UpdateRequiredModal', () => {
  it('renders the modal with i18n title', async () => {
    await render(<UpdateRequiredModal />);
    expect(screen.getByText('versionCheck.modalTitle')).toBeTruthy();
  });

  it('renders the modal message', async () => {
    await render(<UpdateRequiredModal />);
    expect(screen.getByText('versionCheck.modalMessage')).toBeTruthy();
  });

  it('renders the download update button', async () => {
    await render(<UpdateRequiredModal />);
    expect(screen.getByText('versionCheck.modalButton')).toBeTruthy();
  });

  it('has a testID for the modal container', async () => {
    await render(<UpdateRequiredModal />);
    expect(screen.getByTestId('update-required-modal')).toBeTruthy();
  });

  it('does not render any dismissable element (non-dismissable)', async () => {
    await render(<UpdateRequiredModal />);
    // The modal should not have a close/dismiss button
    expect(screen.queryByText('common.dismiss')).toBeNull();
    expect(screen.queryByText('versionCheck.bannerDismiss')).toBeNull();
  });

  it('has accessible elements with proper labels', async () => {
    await render(<UpdateRequiredModal />);
    expect(screen.getByTestId('update-required-modal')).toBeTruthy();
    expect(screen.getByTestId('update-download-button')).toBeTruthy();
  });
});
