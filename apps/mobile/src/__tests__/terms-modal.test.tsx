import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TermsModal } from '@/components/terms-modal';
import type { TermsResponse } from '@sonora/shared';

const mockTerms: TermsResponse = {
  version: '2026.09.1',
  lang: 'es',
  title: 'Términos y Condiciones de Sonora',
  content: 'Este es el texto legal completo que el usuario debe leer y aceptar.',
  contentHash: 'a'.repeat(64),
  publishedAt: '2026-09-14T00:00:00Z',
};

describe('TermsModal', () => {
  it('does not render modal content when visible is false', async () => {
    const { queryByTestId } = await render(
      <TermsModal visible={false} terms={mockTerms} onAccept={jest.fn()} onRetry={jest.fn()} />,
    );

    expect(queryByTestId('terms-modal')).toBeNull();
  });

  it('renders terms title, content, and accept button when visible with terms', async () => {
    const { getByTestId, getByText } = await render(
      <TermsModal visible={true} terms={mockTerms} onAccept={jest.fn()} onRetry={jest.fn()} />,
    );

    expect(getByTestId('terms-modal')).toBeTruthy();
    expect(getByTestId('terms-title')).toBeTruthy();
    expect(getByText('Términos y Condiciones de Sonora')).toBeTruthy();
    expect(getByTestId('terms-content')).toBeTruthy();
    expect(
      getByText('Este es el texto legal completo que el usuario debe leer y aceptar.'),
    ).toBeTruthy();
    expect(getByTestId('terms-accept-button')).toBeTruthy();
  });

  it('calls onAccept handler when accept button is pressed', async () => {
    const onAccept = jest.fn().mockResolvedValue(true);
    const { getByTestId } = await render(
      <TermsModal visible={true} terms={mockTerms} onAccept={onAccept} onRetry={jest.fn()} />,
    );

    await fireEvent.press(getByTestId('terms-accept-button'));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('renders blocking error UI and calls onRetry when retry button is pressed', async () => {
    const onRetry = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, queryByTestId, getByText } = await render(
      <TermsModal
        visible={true}
        terms={null}
        blockingError={{
          title: 'Conexión Requerida',
          description: 'Se requiere conexión a internet para revisar y aceptar los términos.',
        }}
        onAccept={jest.fn()}
        onRetry={onRetry}
      />,
    );

    expect(getByTestId('terms-offline-view')).toBeTruthy();
    expect(getByText('Conexión Requerida')).toBeTruthy();
    expect(
      getByText('Se requiere conexión a internet para revisar y aceptar los términos.'),
    ).toBeTruthy();
    expect(queryByTestId('terms-accept-button')).toBeNull();
    expect(getByTestId('terms-retry-button')).toBeTruthy();

    await fireEvent.press(getByTestId('terms-retry-button'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('displays error message when error prop is provided', async () => {
    const { getByTestId, getByText } = await render(
      <TermsModal
        visible={true}
        terms={mockTerms}
        error="Network error during submission"
        onAccept={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(getByTestId('terms-error-message')).toBeTruthy();
    expect(getByText('Network error during submission')).toBeTruthy();
  });

  it('resets submitting state when onAccept throws an error', async () => {
    const onAccept = jest.fn().mockRejectedValue(new Error('Boom'));
    const { getByTestId } = await render(
      <TermsModal visible={true} terms={mockTerms} onAccept={onAccept} onRetry={jest.fn()} />,
    );

    await fireEvent.press(getByTestId('terms-accept-button'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(getByTestId('terms-accept-button')).toBeTruthy();
  });

  it('falls back to default title when terms title is missing and omits version when version is missing', async () => {
    const termsWithoutTitleOrVersion = {
      ...mockTerms,
      title: undefined as unknown as string,
      version: undefined as unknown as string,
    };

    const { getByTestId, queryByTestId } = await render(
      <TermsModal
        visible={true}
        terms={termsWithoutTitleOrVersion}
        onAccept={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(getByTestId('terms-title')).toBeTruthy();
    expect(queryByTestId('terms-version')).toBeNull();
  });

  it('shows submitting indicator while submission is in progress', async () => {
    const onAccept = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      return true;
    });

    const { getByTestId, findByText } = await render(
      <TermsModal visible={true} terms={mockTerms} onAccept={onAccept} onRetry={jest.fn()} />,
    );

    const pressPromise = fireEvent.press(getByTestId('terms-accept-button'));
    const indicator = await findByText('terms.accepting');
    expect(indicator).toBeTruthy();
    await pressPromise;
  });
});
