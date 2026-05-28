import React from 'react';
import { render } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { HintRow } from '@/components/hint-row';

const mockMap: Record<string, string> = {
  'index.hintRow.title': 'Try editing',
  'index.hintRow.hint': 'app/index.tsx',
};

beforeAll(() => {
  (useTranslation().t as unknown as jest.Mock).mockImplementation((k: string) => mockMap[k] ?? k);
});

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
