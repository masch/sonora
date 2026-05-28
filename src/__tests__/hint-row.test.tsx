/* eslint-disable import/first */
import React from 'react';
import { render } from '@testing-library/react-native';

const mockMap: Record<string, string> = {
  'index.hintRow.title': 'Try editing',
  'index.hintRow.hint': 'app/index.tsx',
};
const mockT = (k: string) => mockMap[k] ?? k;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
}));

import { HintRow } from '@/components/hint-row';

describe('HintRow', () => {
  it('renders with default title and hint', () => {
    const { getByText } = render(<HintRow />);
    expect(getByText('Try editing')).toBeTruthy();
    expect(getByText('app/index.tsx')).toBeTruthy();
  });

  it('renders with overridden title prop', () => {
    const { getByText } = render(<HintRow title="Custom Title" />);
    expect(getByText('Custom Title')).toBeTruthy();
    expect(getByText('app/index.tsx')).toBeTruthy();
  });

  it('renders with overridden hint prop', () => {
    const { getByText } = render(<HintRow hint={<React.Fragment>Custom Hint</React.Fragment>} />);
    expect(getByText('Try editing')).toBeTruthy();
    expect(getByText('Custom Hint')).toBeTruthy();
  });
});
