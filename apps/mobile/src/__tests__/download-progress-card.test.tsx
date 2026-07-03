import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import DownloadProgressCard from '@/components/download-progress-card';

describe('DownloadProgressCard', () => {
  describe('idle state', () => {
    it('renders the download and delete buttons', async () => {
      const onDownload = jest.fn();
      const onDelete = jest.fn();
      const { getByText, getByTestId } = await render(
        <DownloadProgressCard
          status="idle"
          progress={0}
          errorMsg={null}
          onDownload={onDownload}
          onDelete={onDelete}
        />,
      );

      expect(getByTestId('download-progress-card')).toBeTruthy();
      expect(getByTestId('download-button')).toBeTruthy();
      expect(getByTestId('delete-button')).toBeTruthy();
      expect(getByText('components.downloadCard.btnDownload')).toBeTruthy();
      expect(getByText('components.downloadCard.btnDelete')).toBeTruthy();
    });

    it('calls onDownload when download button is pressed', async () => {
      const onDownload = jest.fn();
      const { getByTestId } = await render(
        <DownloadProgressCard
          status="idle"
          progress={0}
          errorMsg={null}
          onDownload={onDownload}
          onDelete={jest.fn()}
        />,
      );

      await fireEvent.press(getByTestId('download-button'));
      expect(onDownload).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when delete button is pressed', async () => {
      const onDelete = jest.fn();
      const { getByTestId } = await render(
        <DownloadProgressCard
          status="idle"
          progress={0}
          errorMsg={null}
          onDownload={jest.fn()}
          onDelete={onDelete}
        />,
      );

      await fireEvent.press(getByTestId('delete-button'));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloading state', () => {
    it('renders a progress bar fill element', async () => {
      const { getByTestId } = await render(
        <DownloadProgressCard
          status="downloading"
          progress={65}
          errorMsg={null}
          onDownload={jest.fn()}
          onDelete={jest.fn()}
        />,
      );

      expect(getByTestId('progress-bar-fill')).toBeTruthy();
    });

    it('renders progress percentage text for any value', async () => {
      const { getByText, rerender } = await render(
        <DownloadProgressCard
          status="downloading"
          progress={42}
          errorMsg={null}
          onDownload={jest.fn()}
          onDelete={jest.fn()}
        />,
      );

      expect(getByText('components.downloadCard.progressPercent')).toBeTruthy();

      rerender(
        <DownloadProgressCard
          status="downloading"
          progress={0}
          errorMsg={null}
          onDownload={jest.fn()}
          onDelete={jest.fn()}
        />,
      );

      expect(getByText('components.downloadCard.progressPercent')).toBeTruthy();

      rerender(
        <DownloadProgressCard
          status="downloading"
          progress={100}
          errorMsg={null}
          onDownload={jest.fn()}
          onDelete={jest.fn()}
        />,
      );

      expect(getByText('components.downloadCard.progressPercent')).toBeTruthy();
    });
  });

  describe('completed state', () => {
    it('renders a checkmark completion indicator', async () => {
      const { getByText } = await render(
        <DownloadProgressCard
          status="completed"
          progress={100}
          errorMsg={null}
          onDownload={jest.fn()}
          onDelete={jest.fn()}
        />,
      );

      expect(getByText('components.downloadCard.statusCompleted')).toBeTruthy();
    });

    it('renders delete button in completed state', async () => {
      const onDelete = jest.fn();
      const { getByTestId } = await render(
        <DownloadProgressCard
          status="completed"
          progress={100}
          errorMsg={null}
          onDownload={jest.fn()}
          onDelete={onDelete}
        />,
      );

      expect(getByTestId('delete-button')).toBeTruthy();
      await fireEvent.press(getByTestId('delete-button'));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('error state', () => {
    it('renders an error message when errorMsg is provided', async () => {
      const { getByText } = await render(
        <DownloadProgressCard
          status="error"
          progress={50}
          errorMsg="Insufficient storage space"
          onDownload={jest.fn()}
          onDelete={jest.fn()}
        />,
      );

      expect(getByText('Insufficient storage space')).toBeTruthy();
    });

    it('renders download button for retry in error state', async () => {
      const onDownload = jest.fn();
      const { getByTestId } = await render(
        <DownloadProgressCard
          status="error"
          progress={50}
          errorMsg="Something went wrong"
          onDownload={onDownload}
          onDelete={jest.fn()}
        />,
      );

      expect(getByTestId('download-button')).toBeTruthy();
      await fireEvent.press(getByTestId('download-button'));
      expect(onDownload).toHaveBeenCalledTimes(1);
    });
  });
});
