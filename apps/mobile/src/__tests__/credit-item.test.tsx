import { render } from '@testing-library/react-native';
import { CreditItem } from '@/components/credit-item';

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      if (key === 'experiences.creditRoles.realization') return 'Realización';
      return options?.defaultValue ?? key;
    },
  }),
}));

describe('CreditItem component', () => {
  it('renders role and names correctly', async () => {
    const { getByText, getByTestId } = await render(
      <CreditItem
        role="realization"
        names="Grupo Arquitectura del juego"
        testID="custom-credit-item"
      />,
    );

    expect(getByTestId('custom-credit-item')).toBeTruthy();
    expect(getByText('Realización')).toBeTruthy();
    expect(getByText('Grupo Arquitectura del juego')).toBeTruthy();
  });

  it('falls back to raw role string when translation is missing', async () => {
    const { getByText } = await render(<CreditItem role="Scenography" names="Arturo Gómez" />);

    expect(getByText('Scenography')).toBeTruthy();
    expect(getByText('Arturo Gómez')).toBeTruthy();
  });
});
