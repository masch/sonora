import React from 'react';
import { Platform, Linking } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AndroidWebGate } from '../android-web-gate';
import * as storeUrlModule from '@/services/store-url';

jest.mock('expo-application', () => ({
  applicationId: 'org.sonoraderivapoeticas.app',
}));

describe('AndroidWebGate', () => {
  const originalOS = Platform.OS;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: 'web',
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('renders nothing when Platform.OS is native (e.g. android)', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Linux; Android 14)' },
      configurable: true,
    });

    await render(<AndroidWebGate />);
    expect(screen.queryByTestId('android-web-gate')).toBeNull();
  });

  it('renders nothing on web when userAgent is not Android (e.g. macOS desktop)', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      configurable: true,
    });

    await render(<AndroidWebGate />);
    expect(screen.queryByTestId('android-web-gate')).toBeNull();
  });

  describe('When on Android Web Browser', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; U; Android 13; en-us; SM-G998B)' },
        configurable: true,
      });
    });

    it('renders the gate with title, message, and button', async () => {
      await render(<AndroidWebGate />);
      expect(screen.getByTestId('android-web-gate')).toBeTruthy();
      expect(screen.getByText('webGate.title')).toBeTruthy();
      expect(screen.getByText('webGate.message')).toBeTruthy();
      expect(screen.getByText('webGate.button')).toBeTruthy();
    });

    it('has accessible button with accessibility label', async () => {
      await render(<AndroidWebGate />);
      const button = screen.getByTestId('android-web-gate-button');
      expect(button).toBeTruthy();
      expect(button.props.accessibilityLabel).toBe('webGate.button');
    });

    it('opens Google Play Store URL when button is pressed', async () => {
      jest
        .spyOn(storeUrlModule, 'getPlayStoreUrl')
        .mockReturnValue(
          'https://play.google.com/store/apps/details?id=org.sonoraderivapoeticas.app',
        );
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

      await render(<AndroidWebGate />);
      const button = screen.getByTestId('android-web-gate-button');
      await fireEvent.press(button);

      expect(openSpy).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=org.sonoraderivapoeticas.app',
      );
    });

    it('falls back to window.location.href when Linking.openURL rejects', async () => {
      const targetUrl =
        'https://play.google.com/store/apps/details?id=org.sonoraderivapoeticas.app';
      jest.spyOn(storeUrlModule, 'getPlayStoreUrl').mockReturnValue(targetUrl);
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Popup blocked'));

      const originalWindow = globalThis.window;
      const mockLocation = { href: '' };
      Object.defineProperty(globalThis, 'window', {
        value: { location: mockLocation },
        configurable: true,
      });

      try {
        await render(<AndroidWebGate />);
        const button = screen.getByTestId('android-web-gate-button');
        await fireEvent.press(button);

        // Allow microtask queue to process the catch block
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockLocation.href).toBe(targetUrl);
      } finally {
        Object.defineProperty(globalThis, 'window', {
          value: originalWindow,
          configurable: true,
        });
      }
    });
  });
});
