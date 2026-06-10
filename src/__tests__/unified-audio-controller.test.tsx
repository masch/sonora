import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import UnifiedAudioController from '@/components/unified-audio-controller';
// Mock translation to output literal keys or expected strings
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'components.mediaControls.statusDownloading') {
        return `Downloading audio (${options?.value}%)…`;
      }
      return key;
    },
  }),
}));

describe('UnifiedAudioController', () => {
  it('renders download & play initial button when undownloaded and idle', () => {
    const onDownload = jest.fn();
    const { getByTestId, getByText } = render(
      <UnifiedAudioController
        downloadStatus="idle"
        downloadProgress={0}
        downloadError={null}
        playerStatus="idle"
        positionMs={0}
        durationMs={0}
        playerError={null}
        onPlay={jest.fn()}
        onPause={jest.fn()}
        onStop={jest.fn()}
        onDownload={onDownload}
      />,
    );

    expect(getByTestId('unified-audio-controller-idle')).toBeTruthy();
    const btn = getByTestId('play-download-button');
    expect(btn).toBeTruthy();
    expect(getByText('components.mediaControls.btnPlayDownload')).toBeTruthy();

    fireEvent.press(btn);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('renders downloading state with progress bar and cancel button', () => {
    const onCancel = jest.fn();
    const { getByTestId, getByText } = render(
      <UnifiedAudioController
        downloadStatus="downloading"
        downloadProgress={45}
        downloadError={null}
        playerStatus="idle"
        positionMs={0}
        durationMs={0}
        playerError={null}
        onPlay={jest.fn()}
        onPause={jest.fn()}
        onStop={jest.fn()}
        onDownload={jest.fn()}
        onCancelDownload={onCancel}
      />,
    );

    expect(getByTestId('unified-audio-controller-downloading')).toBeTruthy();
    expect(getByText('Downloading audio (45%)…')).toBeTruthy();

    const fill = getByTestId('download-progress-bar-fill');
    expect(fill.props.style.width).toBe('45%');

    const cancelBtn = getByTestId('cancel-download-button');
    fireEvent.press(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders AudioMediaControls once download is completed and handles rewind & reset', () => {
    const onPlay = jest.fn();
    const onRewind = jest.fn();
    const onReset = jest.fn();
    const { getByTestId } = render(
      <UnifiedAudioController
        downloadStatus="completed"
        downloadProgress={100}
        downloadError={null}
        playerStatus="idle"
        positionMs={30000}
        durationMs={120000}
        playerError={null}
        onPlay={onPlay}
        onPause={jest.fn()}
        onStop={jest.fn()}
        onRewind={onRewind}
        onReset={onReset}
        onDownload={jest.fn()}
      />,
    );

    expect(getByTestId('audio-media-controls')).toBeTruthy();
    const playBtn = getByTestId('audio-play-button');
    fireEvent.press(playBtn);
    expect(onPlay).toHaveBeenCalledTimes(1);

    const rewindBtn = getByTestId('audio-rewind-button');
    fireEvent.press(rewindBtn);
    expect(onRewind).toHaveBeenCalledTimes(1);

    const resetBtn = getByTestId('audio-reset-button');
    fireEvent.press(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
