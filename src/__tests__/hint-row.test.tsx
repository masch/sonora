import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemedText } from '@/components/themed-text';
import { HintRow } from '@/components/hint-row';

describe('HintRow', () => {
  it('renders with title and hint props correctly', () => {
    const { getByText } = render(
      <HintRow title="Custom Title" hint={<ThemedText>Custom Hint</ThemedText>} />,
    );
    expect(getByText('Custom Title')).toBeTruthy();
    expect(getByText('Custom Hint')).toBeTruthy();
  });
});
