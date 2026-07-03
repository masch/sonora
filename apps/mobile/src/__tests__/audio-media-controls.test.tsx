import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import AudioMediaControls from '@/components/audio-media-controls';

describe('AudioMediaControls', () => {
  it('renders the controls container with testID', async () => {
    const { getByTestId } = await render(
      <AudioMediaControls
        status="idle"
        positionMs={0}
        durationMs={0}
        errorMsg={null}
        onPlay={jest.fn()}
        onPause={jest.fn()}
        onStop={jest.fn()}
      />,
    );

    expect(getByTestId('audio-media-controls')).toBeTruthy();
  });

  describe('play/pause button', () => {
    it('shows Play button when status is idle', async () => {
      const { getByTestId, queryByTestId } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByTestId('audio-play-button')).toBeTruthy();
      expect(queryByTestId('audio-pause-button')).toBeNull();
    });

    it('shows Pause button when status is playing', async () => {
      const { getByTestId, queryByTestId } = await render(
        <AudioMediaControls
          status="playing"
          positionMs={10000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByTestId('audio-pause-button')).toBeTruthy();
      expect(queryByTestId('audio-play-button')).toBeNull();
    });

    it('shows Play button when status is paused', async () => {
      const { getByTestId, queryByTestId } = await render(
        <AudioMediaControls
          status="paused"
          positionMs={30000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByTestId('audio-play-button')).toBeTruthy();
      expect(queryByTestId('audio-pause-button')).toBeNull();
    });

    it('shows Play button when status is stopped', async () => {
      const { getByTestId, queryByTestId } = await render(
        <AudioMediaControls
          status="stopped"
          positionMs={0}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByTestId('audio-play-button')).toBeTruthy();
      expect(queryByTestId('audio-pause-button')).toBeNull();
    });
  });

  describe('button callbacks', () => {
    it('calls onPlay when Play button is pressed', async () => {
      const onPlay = jest.fn();
      const { getByTestId } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={onPlay}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      fireEvent.press(getByTestId('audio-play-button'));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it('calls onPause when Pause button is pressed', async () => {
      const onPause = jest.fn();
      const { getByTestId } = await render(
        <AudioMediaControls
          status="playing"
          positionMs={15000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={onPause}
          onStop={jest.fn()}
        />,
      );

      fireEvent.press(getByTestId('audio-pause-button'));
      expect(onPause).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled state', () => {
    it('does not fire onPlay when disabled is true', async () => {
      const onPlay = jest.fn();
      const { getByTestId } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={onPlay}
          onPause={jest.fn()}
          onStop={jest.fn()}
          disabled={true}
        />,
      );

      fireEvent.press(getByTestId('audio-play-button'));
      expect(onPlay).not.toHaveBeenCalled();
    });

    it('fires onPlay when disabled is false', async () => {
      const onPlay = jest.fn();
      const { getByTestId } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={onPlay}
          onPause={jest.fn()}
          onStop={jest.fn()}
          disabled={false}
        />,
      );

      fireEvent.press(getByTestId('audio-play-button'));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it('fires onPlay when disabled prop is not provided', async () => {
      const onPlay = jest.fn();
      const { getByTestId } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={onPlay}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      fireEvent.press(getByTestId('audio-play-button'));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });
  });

  describe('position and duration', () => {
    it('renders formatted position in minutes when playing', async () => {
      const { getByText } = await render(
        <AudioMediaControls
          status="playing"
          positionMs={65000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByText('1:05 / 2:00')).toBeTruthy();
    });

    it('renders formatted position when paused', async () => {
      const { getByText } = await render(
        <AudioMediaControls
          status="paused"
          positionMs={30000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByText('0:30 / 2:00')).toBeTruthy();
    });

    it('renders only position when durationMs is 0', async () => {
      const { getByText } = await render(
        <AudioMediaControls
          status="playing"
          positionMs={10000}
          durationMs={0}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByText('0:10')).toBeTruthy();
    });

    it('does not render time when status is idle and duration is 0', async () => {
      const { queryByText } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(queryByText('0:00')).toBeNull();
    });

    it('renders formatted position and duration when status is idle and duration > 0', async () => {
      const { getByText } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByText('0:00 / 2:00')).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('shows error message when status is error and errorMsg is provided', async () => {
      const { getByText } = await render(
        <AudioMediaControls
          status="error"
          positionMs={0}
          durationMs={0}
          errorMsg="Playback failed"
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByText('Playback failed')).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator', async () => {
      const { getByText } = await render(
        <AudioMediaControls
          status="loading"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      expect(getByText('components.mediaControls.statusLoading')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('has accessibility label on play button', async () => {
      const { getByTestId } = await render(
        <AudioMediaControls
          status="idle"
          positionMs={0}
          durationMs={0}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      const playButton = getByTestId('audio-play-button');
      expect(playButton.props.accessibilityLabel).toBe('components.mediaControls.btnPlay');
    });

    it('has accessibility label on pause button', async () => {
      const { getByTestId } = await render(
        <AudioMediaControls
          status="playing"
          positionMs={15000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
        />,
      );

      const pauseButton = getByTestId('audio-pause-button');
      expect(pauseButton.props.accessibilityLabel).toBe('components.mediaControls.btnPause');
    });

    it('has accessibility label on rewind button', async () => {
      const { getByTestId } = await render(
        <AudioMediaControls
          status="playing"
          positionMs={15000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
          onRewind={jest.fn()}
        />,
      );

      const rewindButton = getByTestId('audio-rewind-button');
      expect(rewindButton.props.accessibilityLabel).toBe('components.mediaControls.btnRewind');
    });

    it('has accessibility label on reset button', async () => {
      const { getByTestId } = await render(
        <AudioMediaControls
          status="playing"
          positionMs={15000}
          durationMs={120000}
          errorMsg={null}
          onPlay={jest.fn()}
          onPause={jest.fn()}
          onStop={jest.fn()}
          onReset={jest.fn()}
        />,
      );

      const resetButton = getByTestId('audio-reset-button');
      expect(resetButton.props.accessibilityLabel).toBe('components.mediaControls.btnReset');
    });
  });
});
