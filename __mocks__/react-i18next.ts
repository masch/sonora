import React from 'react';

const mockT = jest.fn((key: string) => key);

module.exports = {
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
  Trans: ({ i18nKey, children }: { i18nKey?: string; children?: React.ReactNode }) => {
    if (i18nKey) return (mockT(i18nKey) ?? '') as unknown as React.ReactElement;
    return React.createElement(React.Fragment, null, children);
  },
};
