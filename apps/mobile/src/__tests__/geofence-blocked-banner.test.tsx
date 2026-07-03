import React from 'react';
import { render } from '@testing-library/react-native';

import GeofenceBlockedBanner from '@/components/geofence-blocked-banner';

describe('GeofenceBlockedBanner', () => {
  it('renders the banner container with testID', async () => {
    const { getByTestId } = await render(
      <GeofenceBlockedBanner distanceMeters={null} requiredRadiusMeters={50} />,
    );

    expect(getByTestId('geofence-blocked-banner')).toBeTruthy();
  });

  it('renders the banner title and description', async () => {
    const { getByText } = await render(
      <GeofenceBlockedBanner distanceMeters={null} requiredRadiusMeters={50} />,
    );

    expect(getByText('experiences.geofenceBlocked.bannerTitle')).toBeTruthy();
    expect(getByText('experiences.geofenceBlocked.bannerDescription')).toBeTruthy();
  });

  it('shows distance info when distanceMeters is provided and under 1000', async () => {
    const { getByText } = await render(
      <GeofenceBlockedBanner distanceMeters={120} requiredRadiusMeters={50} />,
    );

    expect(getByText('experiences.geofenceBlocked.bannerDistance')).toBeTruthy();
  });

  it('shows distance info when distanceMeters is 1000 or more', async () => {
    const { getByText } = await render(
      <GeofenceBlockedBanner distanceMeters={1250} requiredRadiusMeters={50} />,
    );

    expect(getByText('experiences.geofenceBlocked.bannerDistance')).toBeTruthy();
  });

  it('shows distance info when distanceMeters is null', async () => {
    const { getByText } = await render(
      <GeofenceBlockedBanner distanceMeters={null} requiredRadiusMeters={50} />,
    );

    expect(getByText('experiences.geofenceBlocked.bannerDistance')).toBeTruthy();
  });

  it('renders the required radius in the description', async () => {
    const { getByText } = await render(
      <GeofenceBlockedBanner distanceMeters={null} requiredRadiusMeters={150} />,
    );

    expect(getByText('experiences.geofenceBlocked.bannerDescription')).toBeTruthy();
  });
});
