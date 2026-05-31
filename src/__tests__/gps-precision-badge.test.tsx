import React from 'react';
import { render } from '@testing-library/react-native';

import GpsPrecisionBadge from '@/components/gps-precision-badge';

describe('GpsPrecisionBadge', () => {
  it('renders the badge container with testID', () => {
    const { getByTestId } = render(
      <GpsPrecisionBadge
        gpsStatus="initializing"
        gpsAccuracy={null}
        distanceMeters={null}
        isNearStart={false}
        requiredRadiusMeters={150}
      />,
    );

    expect(getByTestId('gps-precision-badge')).toBeTruthy();
  });

  describe('initializing state', () => {
    it('shows initializing status text', () => {
      const { getByText } = render(
        <GpsPrecisionBadge
          gpsStatus="initializing"
          gpsAccuracy={null}
          distanceMeters={null}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      expect(getByText('components.gpsBadge.statusInitializing')).toBeTruthy();
    });
  });

  describe('weak signal state', () => {
    it('shows weak GPS signal message', () => {
      const { getByText } = render(
        <GpsPrecisionBadge
          gpsStatus="weak"
          gpsAccuracy={45}
          distanceMeters={200}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      expect(getByText('components.gpsBadge.statusWeak')).toBeTruthy();
    });

    it('shows accuracy value when provided', () => {
      const { getByText } = render(
        <GpsPrecisionBadge
          gpsStatus="weak"
          gpsAccuracy={45}
          distanceMeters={200}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      expect(getByText('45.0m')).toBeTruthy();
    });

    it('shows distance value when provided', () => {
      const { getByText } = render(
        <GpsPrecisionBadge
          gpsStatus="weak"
          gpsAccuracy={45}
          distanceMeters={200}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      expect(getByText('200.0m')).toBeTruthy();
    });
  });

  describe('ready state', () => {
    it('shows ready status text', () => {
      const { getByText } = render(
        <GpsPrecisionBadge
          gpsStatus="ready"
          gpsAccuracy={10}
          distanceMeters={50}
          isNearStart={true}
          requiredRadiusMeters={150}
        />,
      );

      expect(getByText('components.gpsBadge.statusReady')).toBeTruthy();
    });

    it('shows near start indicator when isNearStart is true', () => {
      const { getByText } = render(
        <GpsPrecisionBadge
          gpsStatus="ready"
          gpsAccuracy={10}
          distanceMeters={50}
          isNearStart={true}
          requiredRadiusMeters={150}
        />,
      );

      expect(getByText('components.gpsBadge.nearStart')).toBeTruthy();
    });
  });

  describe('null values', () => {
    it('shows N/A for both accuracy and distance when both are null', () => {
      const { getAllByText } = render(
        <GpsPrecisionBadge
          gpsStatus="initializing"
          gpsAccuracy={null}
          distanceMeters={null}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      const naElements = getAllByText('N/A');
      expect(naElements).toHaveLength(2);
    });

    it('shows no N/A when both accuracy and distance are provided', () => {
      const { queryByText } = render(
        <GpsPrecisionBadge
          gpsStatus="ready"
          gpsAccuracy={10}
          distanceMeters={50}
          isNearStart={true}
          requiredRadiusMeters={150}
        />,
      );

      expect(queryByText('N/A')).toBeNull();
    });
  });
});
