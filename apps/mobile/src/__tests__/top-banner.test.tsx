import React from 'react';
import { render } from '@testing-library/react-native';

import { TopBanner } from '@/components/top-banner';

jest.mock('@/components/icon', () => ({
  Icon: () => null,
}));

describe('TopBanner', () => {
  it('renders successfully with background and logo images', async () => {
    const { toJSON } = await render(<TopBanner />);
    expect(toJSON()).not.toBeNull();
  });
});
