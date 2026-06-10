import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import AudioMediaControls from '@/components/audio-media-controls';

describe('AudioMediaControls', () => {
  it('renders the controls container with testID', () => {
    const { getByTestId } = render(
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
    it('shows Play button when status is idle', () => {
      const { getByText } = render(
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

      expect(getByText('components.mediaControls.btnPlay')).toBeTruthy();
    });

    it('shows Pause button when status is playing', () => {
      const { getByText, queryByText } = render(
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

      expect(getByText('components.mediaControls.btnPause')).toBeTruthy();
      expect(queryByText('components.mediaControls.btnPlay')).toBeNull();
    });

    it('shows Play button when status is paused', () => {
      const { getByText } = render(
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

      expect(getByText('components.mediaControls.btnPlay')).toBeTruthy();
    });

    it('shows Play button when status is stopped', () => {
      const { getByText } = render(
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

      expect(getByText('components.mediaControls.btnPlay')).toBeTruthy();
    });
  });

  describe('button callbacks', () => {
    it('calls onPlay when Play button is pressed', () => {
      const onPlay = jest.fn();
      const { getByTestId } = render(
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

    it('calls onPause when Pause button is pressed', () => {
      const onPause = jest.fn();
      const { getByTestId } = render(
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
    it('does not fire onPlay when disabled is true', () => {
      const onPlay = jest.fn();
      const { getByTestId } = render(
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

    it('fires onPlay when disabled is false', () => {
      const onPlay = jest.fn();
      const { getByTestId } = render(
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

    it('fires onPlay when disabled prop is not provided', () => {
      const onPlay = jest.fn();
      const { getByTestId } = render(
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
    it('renders formatted position in minutes when playing', () => {
      const { getByText } = render(
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

    it('renders formatted position when paused', () => {
      const { getByText } = render(
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

    it('renders only position when durationMs is 0', () => {
      const { getByText } = render(
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

    it('does not render time when status is idle', () => {
      const { queryByText } = render(
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

      expect(queryByText('0:00')).toBeNull();
    });
  });

  describe('error state', () => {
    it('shows error message when status is error and errorMsg is provided', () => {
      const { getByText } = render(
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
    it('shows loading indicator', () => {
      const { getByText } = render(
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
    it('has accessibility label on play button', () => {
      const { getByTestId } = render(
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

    it('has accessibility label on pause button', () => {
      const { getByTestId } = render(
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

    it('has accessibility label on rewind button', () => {
      const { getByTestId } = render(
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

    it('has accessibility label on reset button', () => {
      const { getByTestId } = render(
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
