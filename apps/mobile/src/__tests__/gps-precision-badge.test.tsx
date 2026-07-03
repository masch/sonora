import React from 'react';
import { render } from '@testing-library/react-native';

import GpsPrecisionBadge from '@/components/gps-precision-badge';

describe('GpsPrecisionBadge', () => {
  it('renders the badge container with testID', async () => {
    const { getByTestId } = await render(
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
    it('shows initializing status text', async () => {
      const { getByText } = await render(
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
    it('shows weak GPS signal message', async () => {
      const { getByText } = await render(
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

    it('shows accuracy value when provided', async () => {
      const { getAllByText } = await render(
        <GpsPrecisionBadge
          gpsStatus="weak"
          gpsAccuracy={45}
          distanceMeters={200}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      expect(getAllByText('map.distanceMeters')).toHaveLength(3);
    });

    it('shows distance in meters when under 1000', async () => {
      const { getAllByText } = await render(
        <GpsPrecisionBadge
          gpsStatus="weak"
          gpsAccuracy={45}
          distanceMeters={200}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      expect(getAllByText('map.distanceMeters')).toHaveLength(3);
    });

    it('shows distance in km when 1000 or more', async () => {
      const { getByText } = await render(
        <GpsPrecisionBadge
          gpsStatus="weak"
          gpsAccuracy={45}
          distanceMeters={1250}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      expect(getByText('map.distanceKilometers')).toBeTruthy();
    });
  });

  describe('ready state', () => {
    it('shows ready status text', async () => {
      const { getByText } = await render(
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

    it('shows near start indicator when isNearStart is true', async () => {
      const { getByText } = await render(
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
    it('shows notAvailable key for both accuracy and distance when both are null', async () => {
      const { getAllByText } = await render(
        <GpsPrecisionBadge
          gpsStatus="initializing"
          gpsAccuracy={null}
          distanceMeters={null}
          isNearStart={false}
          requiredRadiusMeters={150}
        />,
      );

      const naElements = getAllByText('index.geofence.notAvailable');
      expect(naElements).toHaveLength(2);
    });

    it('shows no notAvailable when both accuracy and distance are provided', async () => {
      const { queryByText } = await render(
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
